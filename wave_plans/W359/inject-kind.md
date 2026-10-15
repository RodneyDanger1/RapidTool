# W359 · lane `inject-kind` — put the delivery kind into the prompts that shape the product

**Wave:** W359 (kind fidelity). **Persona:** `quill`. **Author:** the wave parent. Read FIRST.

## Mission

The kind is resolved and routed, but **no synthesis prompt contains it**, so the model re-infers the
requested kind from prose — which is why a game brief can come back as a CRUD app. Measured in
`research/multiagent/358_cartographer.md` §3.2, which also gives you the exact sites, content and budget.

## Owned files (yours alone)

`src/lib/codegen.server.ts` · `src/lib/codegen.server.test.ts` · `src/lib/prompt-engine.ts` ·
`src/lib/prompt-engine.test.ts`

## MINI-TASK PLAN

1. **The primary injection — `src/lib/codegen.server.ts:2286` `p6SynthesisChunkUserPrompt`.** It is the
   single context-assembly function behind every synthesis prompt, and `project` is already in scope at all
   four call sites (`:7119`, `:7864`, `:8039`, `:8296`). Add a **project-stable `DELIVERY KIND` block after
   `BRIEF:` and before the volatile `TYPE SIGNATURES` block**, ~1 KB, under the existing caps
   (`P6_SYNTH_PROMPT_MAX_CHARS = 60_000`, `P6_SYNTH_MAX_TOKENS = 32_000`). Two constraints the cartographer
   measured and you must honour: the block must be pushed **into `lines`** so `budgetLeft`
   (`:2411`, computed as `MAX - lines.join("\n").length`) accounts for it — otherwise the `[PRIOR-ELIDED]`
   marker fires ~0.5 KB early; and because the block is project-stable it sits in the **cacheable prefix**,
   which is the DeepSeek prompt-cache lever (`research/deepseek-api.md` §5:
   `prompt_cache_hit_tokens`). Say in the log what you put in the block per kind.
2. **The second site — `src/lib/prompt-engine.ts` (`expansionPrompt:262`, `expandBrief:419`).** Without
   this the `TYPE SIGNATURES` list the synthesis prompt demands stays kind-blind, so a `game` spec that
   never asked for `renderFrame` cannot be repaired by prompt text downstream. **The kind must ride as
   prompt text, NOT as a seventh key**: the envelope is six fixed keys (`EXPANDED_SPEC_KEYS`, `:126-133`)
   validated by `expandedSpecViolations` (`:191`) and repaired once via `EXPANSION_REPAIR_LINE` (`:253`),
   so a seventh key changes `ExpandedSpec`'s persisted shape and every cached `implementationSpec`.
   Concretely: `expansionPrompt(brief, policies, lessons, kind)` adds one `DELIVERY KIND` paragraph next to
   `Brief:` (`:328-329`), and the field rules (`:319-326`) gain per-kind REQUIRED rows — a `game` spec must
   emit input/loop/canvas requirements plus a loop/render signature; a `tool` spec a `main(argv)` signature
   plus exit-code edge cases; a `service` spec a listen/readiness signature; a `library` spec an importable
   public API and a JSX prohibition.
3. **Widen the seam without breaking the test seams.** `codegen.server.ts:6214` is
   `expand: (brief, lessons) => expandBriefWithBackoff(brief, b => expandBrief(b, undefined, lessons))`
   inside `defaultDeps` → widen `P6SynthesisDeps.expand` with a **_trailing optional_** argument so the
   test seams at `codegen.server.test.ts:3179` keep compiling. `headless.ts:6427`'s
   `promptExpand(project, policies)` is `thread-kind`'s file — report the one-line need in your log; do not
   edit it.
4. **Prove the kind reaches the prompt.** Take the `arcade-breakout` brief and show, keyless, that the
   assembled synthesis prompt and the expansion prompt both contain the resolved kind and the per-kind
   REQUIRED rows. No keyed call — this is a prompt-assembly claim, provable from the bytes.
5. **The pre-seal self-typecheck red** (`codegen.server.test.ts`, "fixes/341-1 pre-seal self-typecheck
   gate") is rooted in `scaffold.ts` and owned by `kind-gate`. If your work touches its expectation, say
   so in the log rather than changing it to pass.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/prompt-engine.test.ts
```

## Logging

`fixes/359_inject_kind.md`. Record: the block's content per kind, the budget accounting, the per-kind
REQUIRED rows, the seam widening, the two measured prompts, and the `headless.ts` need you reported.

## Do not

- Do not edit `src/lib/scaffold.ts` (`kind-gate`), `src/lib/engine.ts`/`types.ts` (`resolve-kind`),
  `scripts/**` (`thread-kind`, `kind-corpus`), `src/lib/headless.ts` (`thread-kind`), the register, or
  another lane's log.
- Do not add a seventh envelope key; do not change `ExpandedSpec`'s persisted shape; do not weaken
  `expandedSpecViolations`.
- No keyed LLM call. Do not run the full gate. No git writes.
- **100% working production code only: no mock, stub, fake, demo, or placeholder code on any production
  path.**
