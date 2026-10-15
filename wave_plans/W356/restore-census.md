# W356 · lane `restore-census` — restore an honest census + real refuse semantics

**Wave:** W356 (green recovery + ratchet). **Persona:** `forge`. **Author:** the wave parent.
**You are 1 of 6 lanes.** Read this FIRST — it is your authoritative plan.

## Mission

Undo the **side effect** of the uncommitted 354-wave census change while preserving that wave's intent,
and make `underProduced:"refuse"` actually refuse from the driver seam.

Verified facts you are acting on (parent + adversarial panel, `fixes/355_0_audit_wave.md` §2.1, §2.2):

- `src/lib/compile-check.server.ts:772-790` (working tree) censuses the **whole tree**; HEAD was
  **job-scoped**. A scaffold-only project (`src/main.tsx` + `src/styles.css`) therefore reads
  `verdict:"real", real:2` (HEAD read `empty`).
- On the pinned 13-tree corpus: job-scoped `real` = **6/13**; whole-tree non-empty = **13/13**. The rate
  doubled with **zero product change**. Post-change no tree reads the literal `"real"` — they read
  `"mixed"`.
- The substance **prevention guard C-06** fires only on `verdict==="empty"`, so no tree is `empty` any
  more → `fixtureIntegrity.missed:["C-06"]`. **The guard's defeat is causal to the census change.**
- `src/lib/headless.ts:2838` forwards the under-produced option **only** for `"banner"`, so both the
  default and the explicit `"refuse"` path pass `undefined` and materialize a partial.

## Owned files (yours alone)

- `src/lib/compile-check.server.ts` (+ its colocated `*.test.ts`)
- `src/lib/headless.ts` + `src/lib/headless.test.ts` — you own the test file too, **including** its
  drifted case at `:5999` (`'res.steps' is possibly 'undefined'`; the parent's audit classified it
  **test-wrong** because `steps?: number` is optional by design — fix the test, not the source).

## MINI-TASK PLAN

1. **Publish two readings, both named, neither movable silently.** Restore a job-scoped reading
   (generated-job census) and keep a whole-tree reading, under **distinct field names** —
   e.g. `jobScoped` and `wholeTree` — so that editing one reader can never move the number the campaign
   tracks. **Keep a field that retains shell detection** (`verdict==="empty"` must be reachable for a
   tree whose generated product is empty) so the substance guard can fire again. Do not delete the
   whole-tree reading: it is genuinely useful for the below-floor story. The defect was publishing one
   ambiguous number, so fix that.
2. **Restore the guard signal.** After your change, `node scripts/prevention/verify-prevention.mjs
   --all --selftest` must show C-06 firing again. If the guard's driver keys on a field you renamed,
   that driver is `scripts/prevention/**` and belongs to the **`restore-guards`** lane — put the exact
   field name you kept in your log and report it; do **not** edit the guard yourself.
3. **Make `refuse` refuse at the seam.** In `headless.ts`, forward the caller's resolved under-produced
   policy **explicitly on every path** (including `"refuse"`), so the driver never silently asks for the
   default. The pre-specified cross-lane contract: `restore-oracle` makes `scaffold.ts` treat an absent
   option as **refuse** and honor an explicit `"refuse"` by writing zero files; you make `headless.ts`
   pass the policy through. Both halves must land for the wave to pass.
4. **Keep the honesty of a landed partial.** A below-floor partial that a caller explicitly allowed
   (`"banner"`) must still land with the RED TREE banner and must be *reported* (`belowFloor`,
   recorded seal). Fix the report gap your lane owns.
5. **Prove it, keyless.** Emit a below-floor project keyless and show: `refuse` → **0 files**;
   `banner` → files landed **with** the banner. Show the scaffold-only census case reading `empty`
   again on the job-scoped field. No keyed call.

## Verification (exact commands)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts
node scripts/prevention/verify-prevention.mjs --all --selftest    # expect C-06 firing again
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
```

## Logging

`fixes/356_restore_census.md` — **skeleton first**, then append. Record: old→new for every field you
renamed, the two probes' raw output, the C-06 reading, and anything deferred. Append-only.

## Do not

- Do not edit `src/lib/scaffold.ts` (the `restore-oracle` lane owns it), `scripts/prevention/**` or
  `scripts/guards/**` (`restore-guards`), `scripts/rapidtool-cli.mjs` (`restore-tests`), any doc, the
  register, or another lane's log.
- Do not weaken or delete a guard to make it green. Do not run `gate.sh` / `npm run build` / full
  `npm test` (the parent runs the boundary). Do not make a keyed LLM call. No git writes.
- **Do not introduce or leave any mock, stub, fake, or demo code on a production path.** Test doubles
  belong in test files only.
