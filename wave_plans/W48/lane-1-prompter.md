# W48 / 334-1 — "Prompter" — synthesis correctness, pass 2

Read `wave_plans/W48/README.md` first (Step 0 and the hard rules are there). Your log:
`fixes/334_1_prompter.md`. Owned files: `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`.

## Step 0 reconciliation (do this before any edit)

Read your own `fixes/332_1_prompter.md` (including the appended follow-up that closed the audit's F-1
and F-2), then `fixes/333_1_verifier.md`'s F-1/F-2 sections, then your file on disk. Open your log with
the three lists — **claimed / on disk / still open** — with `file:line` for the last one.

## Fix work

**P1 — the recorded lexical limits of the async guard.** The 333 audit's residual list (now in your code
comments and your log) names what the guard cannot see: a callable that returns a Promise without being
spelled `async`; a receiver call (`obj.m()`, `this.m()`); a dynamic computed key (`fn(id)[k]`). Close the
ones that are decidable without over-refusing, and keep the rest named. In particular a **receiver call
on an async-declared member** and a **statically-resolvable computed key** (`fn(id)["ok"]` is already
refused; `fn(id)[K]` with a const `K`) are worth attempting. **Over-refusing is a worse failure than the
gap** — a legal promise chain refused by this validator surfaces to the user as a synthesis failure —
so every extension needs a legal-control test proving the shape still passes.

**P2 — verify the F-2 deletion left no debris.** `treePlanCensusReconciles` and the unreachable
`p6.tree.shortfall` row were deleted. Confirm no dangling export/import/doc reference survives, and that
the `p6.tree.shortfall` row that *should* still fire (the unbound-declared-job path) does — with a test
that makes it fire on a real project shape, since deleting the other branch risks having removed the
live one by accident. That is a real risk: prove the surviving row works.

**P3 — sweep your file for bugs a fresh pass can see.** The register's still-open `R12-f01` (prior-render
cap) and the chunk-planning path are yours; check the plan's bounds, the prompt's growth cap, any
slice-before-signature, and any comment claiming behavior the bytes do not support.

## Done-when

`node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts` green on Node
22 (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node 24 (baseline **163** — say the new count);
`gates.test.ts` stays green; `npx eslint` on both files exits 0; `npx tsc --noEmit` has zero diagnostics
in your files. No full gate, no `npm run eval`, no keyed calls, no secrets, no repo probe file. Append to
your log; never rewrite it.
