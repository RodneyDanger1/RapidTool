# W359 · lane `thread-kind` — the kind must reach every consumer, including the eval driver

**Wave:** W359 (kind fidelity). **Persona:** `ledger`. **Author:** the wave parent. Read FIRST.

## Mission

The kind is resolved but does not reach its consumers. Measured in
`research/multiagent/358_cartographer.md` §3.3, which names four holes and one of them is the reason the
corpus masks the whole defect.

## The holes (each with its measured evidence)

1. **`scripts/rapidtool-cli.mjs:1632` — the `kind` flag is inert.** The `create` arm calls
   `h.createProject({ brief: briefSource.value, name: args.name })`. `"kind"` **is** registered as a flag
   (`:186`, `:229`) and `headless.createProject` **already accepts** `input.kind` (`headless.ts:503`,
   applied `:513` via `...(input.kind ? { kind: input.kind } : {})`) — the `create` arm simply never reads
   it. Zero-result query: `Select-String -Path scripts\rapidtool-cli.mjs -Pattern 'args\.kind'` → 2 hits,
   both in the `knowledge` verb (`:4795-4796`), neither on the create path.
2. **`src/lib/headless.ts:6602`** — `` `Project: ${project.name} (kind: ${project.kind})` `` in the wild
   planner's context, so on an unstamped run the model literally reads `(kind: undefined)`. Print the
   **resolved** value instead: `` `(kind: ${deliveryKindOf(project)})` ``.
3. **`src/lib/headless.ts:6427`** — `promptExpand(project, policies)`; `project` is in scope, so
   `deliveryKindOf(project)` is free. Widen the call to pass the kind through to
   `prompt-engine.expansionPrompt` (the fourth parameter `inject-kind` is adding). `src/lib/prompt-engine.ts`
   is **not yours** — coordinate via your log.
4. **`scripts/run-eval.mjs:2082` — the fifth point, and the reason the corpus masks the defect.** It has
   its own `deliveryKindOf(corpusKind)` mapper and stamps from the corpus front-matter at `:2122-2123`; it
   maps `library` / `service` / `""` to **`undefined`**, deliberately routing `service` down the
   single-module library path (`:2092-2093`, comment `:2079-2080`). So **a `service` fixture emitted
   through the eval driver still takes the single-module path even after the engine's table is fixed.**
   Decide and implement what that mapper should do, and say so — this is why the measurement has been
   blind.

## Owned files (yours alone)

`scripts/rapidtool-cli.mjs` · `src/lib/headless.ts` · `scripts/run-eval.mjs`
(+ `scripts/run-eval.test.mjs` and `scripts/README-cli.md` if a documented flag's behaviour changes)

## MINI-TASK PLAN

1. Wire the CLI `kind` flag on the `create` path, and make its documented behaviour match: an explicit
   `--kind` wins; absent means the resolver decides (never a silent `app`). Update
   `scripts/README-cli.md` if the verb's flags block changes, and keep its doc-parity tests green.
2. Print the resolved kind at `headless.ts:6602` and thread it at `:6427`.
3. Fix the eval driver's mapper so the corpus stops masking kind, and record the before/after per fixture.
   If routing `service` off the single-module path changes measured results, say so plainly with the
   before/after.
4. Prove each wire keyless: the CLI with and without `--kind`; the planner context string; the eval
   driver's stamp per fixture.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --test --test-reporter=tap scripts/run-eval.test.mjs
node --test --test-reporter=tap scripts/README-cli.test.mjs
node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
```

## Logging

`fixes/359_thread_kind.md`. Record each hole's old→new, the mapper decision with its measured effect, and
anything you had to report rather than edit.

## Do not

- Do not edit `src/lib/scaffold.ts` (`kind-gate`), `src/lib/engine.ts`/`types.ts` (`resolve-kind`),
  `src/lib/codegen.server.ts` / `src/lib/prompt-engine.ts` (`inject-kind`),
  `scripts/quality-ratchet*` (`kind-corpus`), the register, or another lane's log.
- Do not make an absent kind silently become `app`; do not change an exit code or a documented contract
  without updating its test and the doc together.
- No keyed LLM call. Do not run the full gate. No git writes.
- **100% working production code only: no mock, stub, fake, demo, or placeholder code on any production
  path.**
