# W355 · lane `reviewer-synthesis` — code review 2 of 3

**Wave:** W355 (the audit/freeze wave). **Kind:** read-only code review. **Author:** the wave parent.
**You are one of 6 Wave 0 lanes** (3 reviewers · 2 bug inspectors · 1 cartographer).

## Mission

Review the **P6 synthesis → emission → verification chain**. This is the campaign's binding
constraint: the repo's own last wave measured 1/10 acceptance `ok`, `productQuality 0/10`, and the
emitted tree failing its **own** `tsc` on 6/10 briefs. Tell the later waves exactly where the wall is.

## Scope (yours alone)

- `src/lib/codegen.server.ts` — chunked LLM synthesis, `resumeByPath`, the P6 journey cycle deps
- `src/lib/synthesis-policy.ts` — candidate/resample policy, `candidatesLogDetail`
- `src/lib/prompt-engine.ts` — prompt assembly
- `src/lib/scaffold.ts` — the tree writer: oracle emission, `underProductionRefusalOf`, the CJS
  stripper, banners
- `src/lib/product-quality.ts` — the byte-derived product reading
- `src/lib/verify.server.ts`, `verify.ts` — the verify/repair loop
- `src/lib/compile-check.server.ts` — `treeRun`, `assertionIsShapeOnly`
- `src/lib/node-runner.server.ts` — the bounded runner + the secret redactor
- `src/lib/acceptance.ts`, `doctor.ts` (the readings they surface)
- their colocated `*.test.ts`

## Specific questions to answer

1. **The tree's own `tsc` failures.** The last wave saw TS2345, TS2554, TS2322, TS2304, TS7006,
   TS1117 in emitted trees. Trace each class to the codegen/prompt/scaffold decision that permits it.
   Which are preventable by a contract in the prompt, and which need a post-emit repair pass?
2. **Empty-substance trees with a green `tsc`** (`substance.real:0`). Where does an emission become a
   shell? Name the branch.
3. **The oracle trap.** `scaffold.ts` emits NOT-IMPLEMENTED rows as real failing tests when
   `notImplemented > assertable` — so a partially-wired keyed tree can never be green. Is that rule
   right? What would make a *wired* row green without weakening an *unwired* one?
4. **The below-floor guard.** `underProductionRefusalOf` refuses pre-write, so a real keyed run can
   emit **zero files**. Is the banner path (`allowUnderProduced`) reachable from every surface
   (CLI emit, console preview/export, factory-watch)? Name the ones that are not.
5. **`p6-verified` promotion.** Trace how `lastTest {label:"tested", evidenceHash}` gets promoted and
   prove (or refute) that a red tree can never read as promoted.
6. **The redactor bug.** `node-runner.server.ts` treats any non-empty `process.env[name]` as a secret;
   with the documented keyless disable (a single space) it replaces every space in captured output.
   Confirm or refute, with a command.
7. **`product-quality.ts`.** Is the reader honest — i.e. can it ever report `quality:true` for a tree
   that is not a product? Could a later wave cheaply game it? (Wave 3 must not lower this bar.)
8. **The runner's two disagreeing legs.** The bounded-runner spec leg and the tree's own declared
   `npm test` leg were observed to disagree. Which is authoritative, and why?

## Deliverable

`research/multiagent/355_2_review_synthesis.md` — the ONLY file you write. Structure:

1. **Method** — exact commands.
2. **The wall, quantified** — what the bytes say about where P6 loses runs.
3. **Findings** — `id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`.
4. **What is genuinely sound** — with evidence (required).
5. **What I could not verify.**
6. **Recommended owners** — which Wave 2 lane should carry each P0/P1.

## Evidence bar (non-negotiable)

Every finding cites `file:line` **and** the command/read that produced it. Where a doc and the bytes
disagree, the bytes win. Do not restate a doc claim as fact. Do not run a keyed LLM call.

## Do not

- Do not edit any product file, the register, or another lane's report.
- Do not run `npm test`, `npm run build`, or `gate.sh`; targeted per-file runs only. Do not run a
  keyed synthesis (`acceptance-run.mjs` is Wave 2's lane, behind the token ledger).
