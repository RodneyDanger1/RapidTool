# W355 · lane `reviewer-proof` — code review 5 of 7 (GAP-FILLING WAVE 355b)

**Wave:** W355 / batch **355b** (the gap-filling extension of the audit wave).
**Kind:** read-only code review. **Author:** the wave parent.

## Why this lane exists (the gap it fills)

RapidTool's own quality claims rest on a **proof layer**: 34 prevention guards, a keyless replay
harness, `gate.sh`'s stages, an assertion-gap lint, a skip registry, and an acceptance corpus with
graders. That layer is the reason a green reading means anything. **No W355 lane audits it.** And it is
already visibly broken: the parent measured `verify-prevention.mjs --all --selftest` → `ok:false`,
`fixPresence.pending:["C-14"]`, `fixtureIntegrity.missed:["C-06"]` — one guard no longer fires and one
fixer seam is unwired.

This is the "who audits the auditors" lane. If this layer is weak, every "it improved" claim later in
the campaign is hollow.

## Mission

Audit the proof layer for **detector reality** and **measurement validity**: are the guards real
detectors, can any be satisfied without fixing the defect, is the eval corpus strong enough to ground
an improvement claim, and can any metric the campaign's ratchet will use be gamed?

## Scope (yours alone)

- `scripts/prevention/**` — `verify-prevention.mjs`, `replay-harness.mjs`, `cassettes/**` (incl.
  `guard-floor.json`), `README.md`
- `scripts/guards/**` — `guard-registry.json`, `delivery-gate.mjs`, `final-wave-invariants.mjs`,
  `readme-parity.mjs`, `repair-monotonic.mjs`, `runlock-preflight.mjs`, `tree-invariants.mjs`, + tests
- `scripts/gate.sh` and `scripts/gate-verdict.test.mjs`, `scripts/guards/gate-invariants.test.mjs`
- `scripts/check-assertion-gaps.mjs`, `scripts/check-module-coverage.mjs`,
  `scripts/docs-module-parity.mjs`, `scripts/skip-registry.json`
- `scripts/run-eval.mjs` + `run-eval.test.mjs`
- `research/eval-corpus/**` (the 11 brief fixtures + `graders/`) and `research/eval-out/**` (tracked
  results/history)
- `scripts/browser-smoke-verdict.mjs`, `scripts/browser-smoke.mjs` (verdict logic only — the console
  itself belongs to `reviewer-surfaces`)
- `scripts/typecheck-scripts.test.mjs`, `scripts/test-name-pattern-guard.test.mjs`
- The **test-suite honesty** question across `scripts/**/*.test.mjs` and `src/**/*.test.ts` (a sweep,
  not a full read): tests that cannot fail, assertion-free tests, tests that assert a doc string
  instead of behavior, and skip debt.

## Specific questions to answer

1. **C-06 and C-14, root-caused.** Why does C-06 no longer fire on its historical fixture
   (`fixPresence.enforced` lists it, `fixtureIntegrity.missed` does not)? Why is C-14 `pending`? Give
   the `file:line` of the detector and the seam, and the smallest honest fix.
2. **Guard reality.** For each of the 34 registry guards: does the detector fire on a **planted**
   defect, or could it pass on a fixture that was edited? Is any guard's fixture the same artifact the
   guard is supposed to catch (a tautology)? Name any guard whose `countFloor` can be met while the
   behavior it protects is broken.
3. **Can the floor be gamed?** The harness fails if `count < countFloor`. Can a green reading be
   reached by deleting, skipping, or renaming a guard, or by editing a cassette? Trace it and say.
4. **Eval corpus strength.** Are the 11 brief fixtures representative (kinds, domains, sizes), and are
   the graders real — do they check behavior, or shape/format? Would a hollow tree pass a grader?
   Name each grader's false-positive risk.
5. **`run-eval.mjs` validity.** What exactly does the harness measure (`pass@k`, trials, flakiness,
   `redTreeBanner`)? Can any of its numbers be produced without a real keyed run? Does it rewrite
   tracked artifacts (the docs warn it does), and is that disclosed?
6. **Measurement validity for the campaign.** The parent intends a ratchet over: acceptance `ok` rate,
   tree-own-`tsc` pass rate, substantive-tree rate, `productQuality.quality` rate, guard `missed`/
   `pending`, doc-claim count. For each: is the producer honest, and is there a cheap way to move the
   number without improving the product? Name every such shortcut.
7. **`gate.sh` stages.** Does each stage's pass condition match its name? Can a stage be skipped
   silently (a missing tool, an empty test glob, a `--test-name-pattern` matching zero tests)? Note
   the repo's own documented trap: a zero-match pattern exits 0.
8. **Skip debt.** What does `skip-registry.json` excuse, is each excuse still valid, and does anything
   user-visible depend on a skipped test?

## Do NOT duplicate these (already owned by other W355 lanes)

- `codegen`/`scaffold`/`acceptance.ts` internals → `reviewer-synthesis` (it owns the acceptance reader;
  you own the corpus/graders/harness validity).
- `console.tsx`/routes/components/preview → `reviewer-surfaces`.
- Doc-claim drift (counts, verbs, tabs) → `inspector-integrity`.
- The engine/DoD logic → `reviewer-pipeline`.
- If `research/multiagent/355_2_review_synthesis.md` or `355_5_bugs_integrity.md` exists, read and cite
  it rather than re-deriving.

## Deliverable

`research/multiagent/355_8_review_proof_layer.md` — the ONLY file you write. Structure:

1. **Method** — exact commands (incl. `node scripts/prevention/verify-prevention.mjs --all --selftest`
   and targeted per-file test runs).
2. **Guard ledger** — one row per guard: `id | what it detects | fires on a planted defect? | fixture
   is independent? | verdict`.
3. **C-06 / C-14 root cause** — with `file:line` and the smallest honest fix.
4. **Corpus & grader assessment** — per grader: what it checks, and its false-positive risk.
5. **Ratchet gameability** — per metric: honest / gameable, with the shortcut named.
6. **Findings** — `id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`.
7. **What is genuinely sound** — with evidence (required; this layer has real strengths — say so).
8. **What I could not verify.**
9. **Recommended owners** for each P0/P1.

## Evidence bar (non-negotiable)

Every finding cites `file:line` **and** the command or read that produced it. An absence claim needs
the query that shows absence. Where a doc and the bytes disagree, the bytes win.

## Do not

- Do not edit any product file, doc, the register, another lane's report, **or any guard/cassette/
  fixture** — you audit the proof layer; you do not repair it.
- Do not run `npm test`, `npm run build`, or `gate.sh`. Do not run a keyed LLM call. Targeted per-file
  runs and the prevention harness only.
- Do not run any git command that writes.
