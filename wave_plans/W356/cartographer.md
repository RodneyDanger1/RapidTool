# W356 · lane `cartographer` — Wave 1 bug map, architecture delta, and lane-claim verification

**Wave:** W356 (green recovery + ratchet). **Persona:** `cartographer`. **Author:** the wave parent.
**You are 1 of 6 lanes.** This is the standing architecture/verification lane; you recur every wave.

## Mission

Three jobs, in this order.

1. **Verify the other five lanes' claims against the bytes.** They are editing the tree while you read
   it, so pin the exact revision you checked and re-check anything that moved.
2. **Map the new bugs** this wave's changes introduce (regressions) — the failure mode is a fix that
   works in isolation and breaks behaviour elsewhere.
3. **Re-audit architecture** for the campaign's two new owner requirements.

## Owned files (findings only)

- `research/multiagent/356_cartographer.md` (NEW — the only file you write)
- Read anything. Edit nothing else.

## Job 1 — verify the lanes (adversarial, per the W355 discipline)

The audit wave's own record (`fixes/355_0_audit_wave.md` §3) shows a 2-agent panel **corrected five lane
overclaims**. Apply the same discipline here. For each of the five lanes' landing logs
(`fixes/356_*.md`) verify at least:

- **`restore-census`**: the census now publishes two **distinctly named** readings; the shell-detection
  signal is reachable again (a scaffold-only project reads `empty` on the job-scoped reading); and the
  13-tree corpus rate is re-derived. Re-derive the rate yourself and compare with the lane's number. A
  rate that moved must be explainable by a product change.
- **`restore-oracle`**: an unwired row is honestly surfaced and counted; a complete emission is green; a
  partial emission is green **while reporting its shortfall**; `underProduced` absent ⇒ refuse ⇒ zero
  files; `"banner"` ⇒ lands with the banner. Verify each direction by measurement, not by reading the log.
- **`restore-guards`**: `verify-prevention.mjs --all --selftest` → `ok:true`, `missed:[]`, `pending:[]`,
  `count >= countFloor`, and **no guard was weakened, deleted, or satisfied by editing a cassette**. Check
  the cassettes' bytes for edits and say so.
- **`restore-tests`**: each fixed item states source-or-test; the typecheck ratchet still bites (it was
  not loosened); `doctor --project` works.
- **`ratchet`**: the ratchet FAILS on a planted regression (reproduce it yourself if you can); its
  `realProductOnly` and `kindFit` readers are honest (do they false-positive on the real tree?); no
  metric can read `pass` when it is `unavailable`.

Report each as **CONFIRMED / REFUTED / PARTLY / UNDECIDED** with the command that decided it.

## Job 2 — the Wave 1 regression map

New-bug map over this wave's diffs: a boundary hole at a new seam, a renamed field another module still
reads, a guard whose driver now keys on a field that no longer exists, a `gate.sh` stage that masks
another stage's verdict, a ratchet canary that cannot fire, an honest-floor path that now reports success
on a missing value. Each with `file:line` + the query or command that shows it.

## Job 3 — architecture re-audit for the two owner requirements

**(a) Prompt + goal + kind, taken into full account.** Trace the input path end to end: where the brief
enters, where a project's **kind** is resolved, and every consumer of that kind. Does the kind reach
synthesis, emission, the toolchain, and the gates? Name every place a kind is defaulted, ignored, or
assumed to be `app`. This is the map the Wave 2/3 lanes need to make the factory deliver the best
version of the *requested* kind.

**(b) No mock/demo/stub on a production path.** Inventory every mock/stub/fake/demo/test-double in the
tree (`src/lib/llm/providers/mock.ts`, `stub-server.ts`, any `*.fixture*`, any `TODO`-placeholder
emitter) and prove, per item, whether it is **reachable from a production module** or confined to a test
seam. Give the query that shows confinement or reachability. This is the owner's explicit rule; a
production-reachable double is a P0 finding.

## Method and evidence bar

Every claim cites `file:line` and the command or read that produced it. Every absence claim carries its
zero-result query. Where a lane's log and the bytes disagree, **the bytes win** — record it as a
correction. State plainly what you could not determine (a mid-edit tree is a legitimate reason).

## Do not

- Do not edit any product file, doc, script, the register, or another lane's log.
- Do not run `gate.sh` / `npm run build` / full `npm test`. No keyed LLM call. No git writes.
- Do not accept a lane's log as evidence for that lane's own claim.
