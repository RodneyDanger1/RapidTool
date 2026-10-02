# W46 / 332-1 — "Prompter" — synthesis correctness (async + coverage)

Read `wave_plans/W46/README.md` first. Also read `wave_plans/W45/parent-keyed-findings.md` (the keyed
evidence) and register `AW45-c02/c03/c04`. Your log: `fixes/332_1_prompter.md`.

## Owned files (STRICT)

`src/lib/codegen.server.ts` · `src/lib/codegen.server.test.ts`

## Findings you are fixing

**P1 (the #1 blocker to the maker test) — generated modules call async imports without `await`.**
Measured on a real keyed run (`%TEMP%\rt331_final`, tree compiles 13/13, generated core loads and runs,
spec 24 pass / 1 fail). The generated `src/jobs/rehab.ts`:

```js
function getRehabTimeline(propertyId) {
  return Promise.resolve().then(function () {
    ...
    var property = getProperty(propertyId);      // async import, NOT awaited
    if (property && property.ok === false) {     // reading .ok off a Promise => undefined
```

`getProperty` returns a Promise, so `.ok` is `undefined`, the real validation error is never surfaced
to the caller, and the rejected promise floats: node:test reports *"generated asynchronous activity
after the test ended … unhandledRejection"* and reds the whole spec FILE, which blocks the green
tree-run that `p6-test`/`p6-verified` and `mintTreeRunTested` require.

Decide and implement the honest defense **inside your files** (a prompt rule alone is not enough — say
why you chose what you chose):
- a `p6SynthesisSystemPrompt()` rule (see `:542`) that names the failure shape, and/or
- a `validateSynthesisModule` refusal for the detectable form — a value imported from a sibling chunk
  (or declared `async`) used in a **value position** without `await`, i.e. a property read or a
  destructure off the call result, or the body wrapping itself in `Promise.resolve().then(...)` while
  calling async imports synchronously. Route the refusal into the existing one bounded repair re-prompt
  (there is precedent: the 331 wave added the cross-chunk duplicate-declaration refusal).

**P2 — keyed coverage varies run to run, so `p6-arch` intermittently fails.** Run A emitted 7 modules
and `p6-arch: PASS`; run B emitted 5 and `p6-arch: FAIL` (`# P6 architecture trace` names the missing
capabilities). The declared job set is capped (`lattice.jobs.slice(0, 5)` in `algorithms.ts`, which you
do **not** own) and the plan's job→file coverage is not guaranteed. Make the failure *legible and
deterministic* rather than random: the plan already has `treeChunkPlanCensus` + a persisted
`p6.tree.shortfall` row (331-4 landed them) — verify they fire on the run-B shape, name every unbound
declared job, and that `p6-arch`'s unmet list agrees with the census. If a capability can be mapped
when a bound signature exists, do it; where it cannot, the shortfall must be counted, never silent.

**P3 — sweep your two files** for the classes earlier waves found: unbounded prompt growth (`R12-f01`
prior-render cap), slices taken before a signature, claims the bytes do not support, silent drops.

## Rules

No keyed calls are needed for P1/P2 (the failing module and the census are reproducible from recorded
bytes — ask the parent for the recorded project if you need it, or synthesize the shape). Node 22
`%LOCALAPPDATA%\hermes\node\node.exe` + host Node 24, `--test-reporter=tap`. Targeted suite:
`node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts`
(baseline 148 tests). No full gate, no `npm run eval`, no secrets.

## Report back

Verdict per finding · the P1 before/after (a real reproduction: the emitted module's bytes or the
validator's refusal, and the spec's pass/fail line) · the P2 census output for both run shapes · tests
added with real numbers on both runtimes · what you stopped on.
