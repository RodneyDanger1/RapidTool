# W355 · lane `inspector-integrity` — bug inspector 2 of 2

**Wave:** W355 (the audit/freeze wave). **Kind:** read-only integrity inspection. **Author:** the wave parent.
**You are one of 6 Wave 0 lanes** (3 reviewers · 2 bug inspectors · 1 cartographer).

## Mission

Hunt the class of defect that matters most in this repo: **a claim that the bytes do not support.**
RapidTool's own doctrine is "if a doc and the bytes disagree, the bytes win", and it has a history of
drift surviving for waves. Your subject is the honesty layer: documentation truth, the error-code
registry, provenance, secret handling, and cost/accounting claims.

This is not pedantry: a doc that lies about behavior is how a future session ships a regression.

## Scope (yours alone)

- The root docs: `README.md` (89 KB), `AGENTS.md`, `START-HERE.md`, `RUNBOOK.md`, `docs-FOLDER-MAP.md`,
  `LAUNCH.md`, `RESUME.md`, `remainingwaves.md`, `finalsprint.md`, `taskuniverselog.md`,
  `AGENT_GUIDE.md` (skim for claims; check the checkable ones)
- `src/lib/errors.ts` — the `RT_E_*` registry + `ERROR_CODE_DOC`
- `src/lib/product-quality.ts`'s honesty claims; `src/lib/acceptance.ts`, `doctor.ts` (readings)
- `src/lib/ledger`-adjacent provenance: `policy.ts`, `dod.ts` (read for provenance claims only — the
  pipeline reviewer owns their logic), `token-ledger.ts`
- `src/lib/node-runner.server.ts` (secret redaction only)
- `scripts/check-module-coverage.mjs`, `docs-module-parity.mjs`, `brand-check.mjs` (doc/claim guards)
- `research/multiagent/thoroughanalysis.md` — **read its header** for the register's append protocol

## Specific questions to answer

1. **Counts and inventories.** The docs carry many dated count blocks (files, tests, verbs, tabs,
   guards). Re-derive the checkable ones **today** with `git ls-files`/`grep`/`Select-String` and list
   every claim that is now false. Include: `src/lib` file count, `scripts` count, `fixes` count,
   `wave_plans` count, the CLI verb count (`grep -c 'case "'`), the console tab count, the prevention
   guard count, the Node pin vs this host.
2. **Known stale claim.** `AGENTS.md`'s 346 "Corrections in force" still says `emit --git` WITHOUT
   `--run` still commits — the repo's own W353 log says W352 R-19 removed that residual. Confirm which
   is true **on the bytes** now, and find other claims in the same family.
3. **The `RT_E_*` registry.** Is every code raised in `src/**` and `scripts/**` present in
   `ERROR_CODE_DOC`? Is every documented code actually raised? Give the two lists and the difference.
4. **Provenance.** Verify the claim "a machine path may never mint `decidedBy:"human"`" against the
   bytes, and verify the console seat is recorded as UNATTESTED. Cite the test that pins it, if any.
5. **Cost honesty.** Verify that `estimatedCostUsd` is never fabricated (always `null`) and that
   token/spend figures come from real usage. Find any place a spend number could be invented.
6. **Secret handling.** Verify no secret is read via `import.meta.env`, no `VITE_`-prefixed secret
   exists, and no key-shaped value is committed (check `git ls-files` for `.env`, and the tracked
   `*.log` files). Report only the **shape** of a problem, never a key value.
7. **Determinism claims.** The repo exposes a determinism reading naming fields derived from
   `crypto.randomUUID()`, `Date.now()`, and `fnv1a`. Is that reading accurate, and does anything
   user-visible depend on a non-reproducible field while claiming reproducibility?
8. **The register.** Does `thoroughanalysis.md`'s append protocol still describe what the file
   actually is? Are there findings recorded there that are now fixed but not struck/annotated?

## Deliverable

`research/multiagent/355_5_bugs_integrity.md` — the ONLY file you write. Structure:

1. **Method** — the exact re-derivation command beside each claim you checked.
2. **Claim-vs-bytes table** — `claim | where (file:line) | what the bytes say | command | verdict
   (true/stale/false)`.
3. **`RT_E_*` registry delta** — raised-but-undocumented and documented-but-unraised, as two lists.
4. **Honesty findings** — `id | severity (P0/P1/P2/P3) | title | evidence | why it matters`.
5. **What is genuinely honest** — with evidence (required; do not only report failures).
6. **What I could not verify.**

## Evidence bar (non-negotiable)

Every verdict rests on a command you ran or a `file:line` you read. A count claim must carry the
command that re-derived it. Do not quote a doc as evidence for itself.

## Do not

- Do not edit any product file, the register, another lane's report, or **any doc** — Wave 1's
  `docs-ledger` lane fixes what you find. You report; you do not repair.
- Do not run `npm test`, `npm run build`, or `gate.sh`; targeted per-file runs and greps only.
- **Never print a secret value.** Report at most a tail or a shape, and say explicitly that you redacted.
