# W359 · lane `resolve-kind` — the kind resolver must stop mis-resolving, and must say so with evidence

**Wave:** W359 (kind fidelity). **Persona:** `forge`. **Author:** the wave parent. Read FIRST.

## Mission

The factory cannot deliver the best version of the requested kind if it resolves the wrong kind.
Measured (`research/multiagent/357_cartographer.md`, re-derived in `358_cartographer.md` §3.1): the
ordered **first-hit keyword table** at `src/lib/engine.ts:219-241` **mis-resolves 3 of the 10 corpus
briefs**:

| brief | resolves to | via |
|---|---|---|
| `arcade-breakout` (**the only game brief**) | `app` | the noun `screen`/`screens` |
| `showing-booking` | `tool` | the noun `agent` |
| `coffeehouse2home` | `service` | (the cartographer's third) |

A first-hit table is order-dependent, so the first keyword to appear in prose decides the product's entire
shape. This is a **P0 for the campaign's stated purpose**.

## Owned files (yours alone)

`src/lib/engine.ts` · `src/lib/engine.test.ts` · `src/lib/types.ts` (only if the recorded resolution shape
needs a field)

## MINI-TASK PLAN

1. **Replace the resolver with a scored, evidence-recording resolution.** Requirements: a weighted keyword
   table with explicit weights and a documented tie policy; a deterministic result for a given brief; and a
   recorded `kindResolution` carrying `{kind, confidence, evidence[]}` on the project so every downstream
   consumer and every audit can see **why**. Keep the exported surface names the rest of the tree uses
   (`deliveryKindOf`, `inferDomain`, `withDeliveryKind`) and do not break their signatures.
2. **Name the briefs that must flip**, and prove it: `arcade-breakout` → `game`, plus whatever the scored
   model decides for `showing-booking` and `coffeehouse2home` — and list the briefs that must **still**
   resolve as they do today (a resolver change that silently re-kinds a working brief is a regression).
   Put both lists in your log with the input that drives each.
3. **Stamp the kind on every path.** The stamp call is `src/lib/engine.ts:4074` (`p = withDeliveryKind(p);`
   — note `:4073` is its comment line; the W357/W358 reports cite the wrong line). It sits inside
   `upgradeP6Keyed` behind `if (!isBareNodeHost()) return floor;` (`:4059`) and
   `if (!configured) return floor;` (`:4063`), so **on the keyless path and on any non-DeepSeek run
   `Project.kind` stays absent** and every consumer re-infers. Make the resolved kind present regardless
   of key state (the resolution is deterministic and needs no model), and say in the log what you changed
   about the keyed-only guard and why that is safe.
4. **A memo or a cached kind is not acceptable** if it can go stale against an edited brief: state the
   invalidation rule in the log.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/engine.test.ts
# your own probe over the corpus briefs, before/after, keyless
```

## Logging

`fixes/359_resolve_kind.md`. Record: the weighted table, the tie policy, the must-flip list with proofs,
the must-not-change list, the keyless-stamp change, and the invalidation rule.

## Do not

- Do not edit `src/lib/scaffold.ts` (`kind-gate`), `codegen.server.ts` / `prompt-engine.ts`
  (`inject-kind`), `scripts/**` (`thread-kind`, `kind-corpus`), the register, or another lane's log.
- Do not silently re-kind a brief that works today; do not add a model call to the resolution.
- No keyed LLM call. Do not run the full gate. No git writes.
- **100% working production code only: no mock, stub, fake, demo, or placeholder code on any production
  path.**
