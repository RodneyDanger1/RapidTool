# W12 · LANE A — Bug hunter 1: refusals, the error classifier, and the bare catches

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §5.4 (honesty invariants),
`fixes/216y_oracle_and_error_audits.md` **§2.1–§2.3** (the audit whose findings you are enacting —
your defects are its **G3** and **G7**), `src/lib/errors.ts` (`ERROR_CODE_DOC` is the canonical
registry) and `scripts/README-cli.md` §the RT_E taxonomy.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2, git-bash /c/Users/mnril/Desktop/RapidTool Main).
PATH HAS A SPACE → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
MANDATORY RULES (the parent rejects violations):
1. PATCH-ONLY targeted edits with the `patch` tool. Never write_file on an existing file.
2. No mock/demo/stub/placeholder/TODO code. Real logic, file style, explicit `.ts` import extensions.
3. NEVER run git checkout/stash/reset/clean/commit.
4. Stay strictly inside your owned files. Need a change elsewhere? STOP and report it.
5. Verify with `node --experimental-strip-types --test --test-concurrency=2 <your test file>` and
   AT MOST ONE `npm run typecheck` at the very END. NEVER run `npm test` or `npm run build`
   (6 other lanes share this 8 GB machine; never run two heavy commands at once).
6. Every claim needs a command you actually ran + its real output. Never invent counts. If you run
   out of budget, say so plainly and describe the real state — an honest "incomplete" beats a
   claimed green.
7. If an existing test pins OLD behaviour you may update it — record old → new + why. Never weaken
   an assertion or delete a test to get green.
8. Write your landing log at the path below (you are its only writer): skeleton FIRST, then fill.
```

**Owned files (ONLY these):** `src/lib/errors.ts`, `src/lib/errors.test.ts`,
`src/lib/auth/popup.server.ts`, `src/routes/__root.tsx`
**Landing log:** `fixes/217j_error_classifier_and_bare_catches.md`

**Persona:** you are the defect hunter for the *failure path*. A system that reports the wrong
reason for its failures is lying by omission — and this repo's contract is that every surfaced
failure carries an actionable `RT_E_*` code.

## Numbered plan

1. **Landing-log skeleton + reproduce every claim before touching anything.** Write
   `fixes/217j_…md` with the section headers and a "status: in progress" line.
2. **G3 — classifier coverage holes (the main item).** `fixes/216y` §2.3 G3, verified 2026-09-17:
   `EACCES`, `ENOSPC`, `ECONNREFUSED`, `ENOTFOUND`, `EADDRINUSE`, `"fetch failed"` and JSON-parse
   errors **all classify to `RT_E_UNKNOWN`** (probe result 7/7), whose own doc says *"the failure is
   opaque"*. The classifier is the `errCode`/error-classification path in `src/lib/errors.ts`
   (the audit's anchors: `errors.ts:109-152`, registry `:22-45`, `:218+`).
   - **First reproduce it yourself** with a small read-only probe (keep probes OUTSIDE the repo,
     e.g. `C:/Users/mnril/w12a_scratch/`, or a temp dir; do not add probe files to the repo).
     Paste the raw output as evidence. If a case is already classified correctly, say so.
   - **Then fix it properly**: give each of those codes its own actionable classification (or the
     smallest honest grouping that names the real remedy — e.g. network unreachable vs permission
     denied vs disk full vs port already in use must not share one opaque code). If you add a new
     `RT_E_*` code you MUST register it in `ERROR_CODE_DOC` with an honest doc string, and keep the
     existing codes' meanings unchanged (other suites pin them — run `errors.test.ts` before AND
     after and record counts). Do **not** invent a code for a case you cannot describe a remedy for.
   - **Tests** in `src/lib/errors.test.ts`: one per newly classified case (feed the real Node error
     shape with its `code` property), plus a negative test that a genuinely unknown error still
     lands on `RT_E_UNKNOWN` (the honest fallback must survive).
3. **G7 — the four truly bare catches.** The audit found 4 code-free catches with no comment:
   `src/lib/auth/popup.server.ts:149-153` (three sites) and `src/routes/__root.tsx:69` (the inline
   theme script). Blast radius: popup messaging + theme only. **Do not change behaviour to make the
   warning go away.** For each site decide honestly, on the evidence: (a) is the failure genuinely
   benign and best-effort? → document *why* in a precise comment (what can throw, why ignoring it is
   correct, what the user sees instead). (b) is it hiding a real failure? → surface it through the
   existing telemetry seam (`src/lib/rt-events.ts` / the runtime ring — read how neighbours do it;
   telemetry must never throw into the code it observes, per AGENTS.md). Record per-site which call
   you made and why. `__root.tsx` is a route file — keep the change inside the existing inline
   script's block and do not alter what it renders.
4. **Sweep for the same class you just fixed**, but only within your owned files: grep for
   `catch` and for `unknown`/`opaque` classifications; fix what is genuinely the same defect and
   list every other site you found with file:line in your log as a *report* (do not edit files you
   do not own).
5. **Verify + log**: run `errors.test.ts` (and `--test-concurrency=2`) before/after, then one
   final `npm run typecheck`; paste the real tails and the old → new counts into the log.
   Finish the log with: what changed, file:line, the reproduction evidence, what could break, and
   the exact list of items you did NOT do.
