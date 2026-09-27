# fixes/288_q2_syntax.md — W39 · LANE Q2 · INDUSTRY-STANDARD SYNTAX/CALLS/COMMANDS SWEEP

**Lane:** W39 Q2. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep-style tools fail, terminal `rg` after `cd` works).
**Mission:** CODE-ONLY, light-touch, smallest patches. Evidence per fix (grep/AST line refs).
**Baseline HEAD:** `0f85c32` + the W29–W39 uncommitted era. Node v22.23.2 (verified: strip-types REJECTS extensionless relative imports — `ERR_MODULE_NOT_FOUND`, scratch proof in scratch dir).

Methods: AST sweep (TypeScript compiler API, scratch script outside the repo) over `src/ scripts/ server/` (246 files) for: extensionless/odd-ext module specifiers, `catch (e: any)`, loose `==`, `let`-never-reassigned, duplicate object keys, unreachable stmts after jump, builtin imports without `node:`, `@ts-ignore` family, non-null assertions, floating-promise expression statements (type-checker), plus doc/command greps.

## Item ledger (append-only — one row per fix; `file:line` → before → after)

| # | Site | Before | After | Evidence |
|---|------|--------|-------|----------|
| 1 | `src/lib/auth/client.ts:4` | `from "./providers"` | `from "./providers.ts"` | AST A-sweep; Node 22.23.2 strip-types requires explicit ext |
| 2 | `src/lib/auth/gate-session.server.ts:5,12` | `"./gate-identity.server"`, `"./gate-session-marker"` | both `+.ts` | AST A-sweep |
| 3 | `src/lib/auth/gates.tsx:3-6` | `./client`, `./gate-session-marker`, `./sign-in-gate`, `./use-current-user` | all `+.ts` | AST A-sweep |
| 4 | `src/lib/auth/popup.server.ts:19` | `"./server"` | `"./server.ts"` | AST A-sweep |
| 5 | `src/lib/auth/server.ts:38-43,261` | `../db`, `./email-password`, `./gate-session.server`, `./providers` ×2, `./pglite-dialect`, `./preview` | all `+.ts` | AST A-sweep |
| 6 | `src/lib/auth/use-current-user.ts:1` | `"./client"` | `"./client.ts"` | AST A-sweep |
| 7 | `src/lib/auth/verify.server.ts:2,3` | `"./gate-identity.server"`, `"./server"` | both `+.ts` | AST A-sweep |
| 8 | `src/lib/multiplayer/index.ts:1,2` | `"./p2p"` ×2 | `"./p2p.ts"` | AST A-sweep |
| 9 | `src/router.tsx:4` | `"./routeTree.gen"` | `"./routeTree.gen.ts"` | AST A-sweep (`.gen` is not an extension) |
| 10 | `src/lib/algorithms.ts:3`, `engine.ts:47`, `phases.ts:1`, `store.ts:31` | type-only `import type … from "./types"` | `+".ts"` | AST A-sweep; erased at runtime but house contract = explicit `.ts` in the src chain |

## Verified-zero / reviewed-no-change (with evidence)

- **`catch (e: any)` = 0** (AST B, all 246 files). `catch (e: unknown)` discipline holds.
- **`@ts-ignore` = 0**; the `@ts-*` family is 10× `@ts-expect-error` in tests only (diagnose.test.ts 1, vault.test.ts 9).
- **builtin imports without `node:` = 0** (AST H over import/export/dynamic-import specifiers).
- **duplicate object-literal keys = 0**; **unreachable statements after `return`/`throw`/`break`/`continue` = 0** (AST F/G, blocks + case clauses).
- **loose `==`/`!=`** (AST C, code files): 28 total, **all** are the deliberate nullish idiom (`x == null` / `x != null` — covers `null|undefined`); zero value-comparisons. Rewriting to `!==` would change semantics. Lint does not ban them (eslint.config.mjs has no `eqeqeq`); the repo's own oracle flags loose `==` only in *generated* code. → reviewed, no change.
- **floating promises** (type-checker FP section, non-test src): 1 expression statement — `src/components/console.tsx:4044` (see below).
