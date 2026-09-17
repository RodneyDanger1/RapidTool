# 214 — factory evidence from leftover-job census (not a frozen flag)

## What was broken

`doctor.factory` used a frozen `RAPIDTOOL_FACTORY_EVIDENCE` bag. That is honest
*today* (leftover jobs **are** stubs) but it could not become true from field
files — a later edit could flip the constant while flip/record/publish still
throw `TODO(E-15)`.

## Landed

1. **`classifyJobSource` / `inventoryFromJobSources` / `evidenceFromJobInventory`**
   in `doctor.ts` (client-safe). Stub = `TODO(E-15)` or `throw new Error("TODO…")`.
   Reexport-only = every statement is `export … from` / `import … from`.
   `realMultiJobProduct` only when ≥2 real jobs **and** zero leftover stubs/reexports.
   Does **not** mint `humanFixtures` or `productComplete` from job bytes.

2. **`headless.collectJobSources` + `doctorStatus({ treeDir })`** — scans
   `src/jobs/*` and `jobs/*`. Absent tree → inventory `null` (RAPIDTOOL-now bag).

3. **CLI `doctor --tree <dir>`** — census on stdout. Coffeehouse2Home eval-out
   is the live pin: flip/record/publish = stub, factory stays **false**.

4. **Never invents flip/record/show/publish bodies.** The scan *names* leftovers.

## Still false

- Not an autonomous software factory.
- Real leftover jobs still need keyed P6 + human fixtures.
- `keyed --all` still user-gated.
