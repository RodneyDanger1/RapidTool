# W355 · lane `reviewer-platform` — code review 4 of 7 (GAP-FILLING WAVE 355b)

**Wave:** W355 / batch **355b** (the gap-filling extension of the audit wave).
**Kind:** read-only code review. **Author:** the wave parent.

## Why this lane exists (the gap it fills)

The first six W355 lanes cover the engine (`reviewer-pipeline`), synthesis/emission
(`reviewer-synthesis`), the surfaces + CLI (`reviewer-surfaces`), the red baseline
(`inspector-correctness`), doc/claim honesty (`inspector-integrity`), and the architecture map
(`cartographer`). **None of them covers the foundation**: persistence and state, identity and auth,
the data layer, configuration, credentials, the model-provider seam, the write-safety primitives, or
the build/deploy/launch path. This lane owns that whole layer.

Evidence of the gap: `src/lib/auth/**` is **19 files**, including the brand-new untracked
`account.ts` / `account.test.ts` / `account-default.test.ts` — and no W355 lane has it in scope.

## Mission

Audit the foundation for correctness, honesty and safety: does the app persist and restore what it
claims, is identity real when enabled and inert when disabled, is every secret resolved by the
documented precedence, does every LLM call site honour the DeepSeek API contract in
`research/deepseek-api.md`, and are the write/archive primitives safe?

## Scope (yours alone)

**Persistence & state:** `src/lib/db.ts`, `pglite-dialect.ts`, `checkpoint.server.ts`,
`src/lib/state`-adjacent writers (`write-set.ts`), `migrations/**`, `scripts/migrate.mjs`,
`scripts/migration-plan.mjs`.
**Identity & auth:** `src/lib/auth/**` (all of it — `server.ts`, `middleware.ts`,
`isolation.server.ts`, `gate-identity.server.ts`, `gate-session*.ts`, `account.ts`,
`email-password.ts`, `verify.server.ts`, `client.ts`, `login.ts`, `sign-in-gate.ts`,
`use-current-user.ts`), `scripts/check-auth-invariant.mjs`.
**Configuration & credentials:** `scripts/with-app-env.mjs`, `.env.example`, `src/lib/key-resolution.ts`,
`src/lib/key-source.server.ts`.
**The model-provider seam:** `src/lib/llm/**` (incl. `providers/registry.ts`, `deepseek.ts`,
`openai-compatible.ts`, `one-shot-fetch.server.ts`, `key-resolution.ts`), `src/lib/deepseek.ts`,
`deepseek.server.ts`, `llm.ts`, `llm-tasks.ts`, `providers.ts`, `registry.ts`, `cassette.ts`,
`token-ledger.ts`.
**Write safety:** `scripts/path-safety.mjs`, `scripts/write-atomic.mjs`.
**Build / deploy / launch config:** `vite.config.ts`, `tsconfig.json`, `tsconfig.scripts.json`,
`eslint.config.mjs`, `.prettierrc`, `package.json` scripts, `.github/workflows/gate.yml`,
`.vercel/**`, `server/**` (legacy — decide only its load-bearing status), `scripts/brand-check.mjs`.

## Specific questions to answer

1. **Precedence honesty.** The docs specify: `<cwd>/.env` wins over the process env; a
   present-but-blank value is an intentional keyless disable; a differing non-blank ambient value
   loses behind `RT_E_LLM_KEY_SHADOWED`. Verify every one of those four cases against the bytes, on
   **every** surface (CLI, server read, Vite dev server). Name any surface that disagrees.
2. **The DeepSeek contract.** `research/deepseek-api.md` is a live-verified spec. For each call site:
   is `max_tokens` always explicit? is the `thinking` shape correct per tier? does JSON mode carry the
   required "respond in JSON" instruction? is `finish_reason:"length"` handled as truncation? is
   `insufficient_system_resource` retried, `content_filter` NOT retried, and 401/402 NOT retried? Are
   reasoning tokens accounted? Is `prompt_cache_hit_tokens` / `prompt_tokens_details.cached_tokens`
   read anywhere, and could a stable shared prefix raise the cache-hit rate?
3. **Auth honesty.** With `VITE_AUTH_ENABLED=false` (the shipped default) does the app render with no
   login demanded, byte-identically? With it on, is sign-in real (a real per-user server function
   behind middleware) or a facade? Is any per-user data reachable without a user id?
4. **Persistence truth.** PGLite vs `DATABASE_URL`: what exactly persists, where, and across restarts?
   Does `npm run build`'s `db:migrate` leg run safely with no database configured? Can a migration
   fail silently? Is the persistent PGLite data dir (the 354 wave's change) actually honored on load?
5. **Write safety.** Can `path-safety`/`write-atomic`/`write-set` be defeated by a hostile path (zip
   entry, `..`, absolute path, symlink, reserved Windows name, case-insensitive collision)? Give a
   concrete input if you find one.
6. **Performance & scale.** Where does the foundation become the bottleneck on a real run: PGLite
   writes per artifact, the NDJSON telemetry log, the token ledger, the provider timeout budget, or
   the migration path? Name the hot path with evidence and its bound.
7. **Config hygiene.** Is any secret reachable from a client bundle (any `VITE_`-prefixed secret, any
   secret read in a non-`.server` module)? Is `server/**` legacy middleware load-bearing or dead?
8. **Tests.** Which foundation invariants are unpinned? Name the specific missing test.

## Do NOT duplicate these (already owned by other W355 lanes)

- `node-runner.server.ts` secret redactor, `compile-check.server.ts`, `verify.server.ts` →
  `reviewer-synthesis`.
- `engine.ts`/`headless.ts`/`store.ts`/`dod.ts`/`policy.ts` → `reviewer-pipeline`.
- `console.tsx`, `src/routes/**`, `src/components/**`, `software-export.ts`, `preview*`, `zip.ts`,
  `io.ts`, `artifacts.ts`, `chat.ts`, `scripts/rapidtool-cli.mjs` → `reviewer-surfaces`.
- Doc-claim drift → `inspector-integrity`. The red baseline → `inspector-correctness`.
- If `research/multiagent/355_2_review_synthesis.md` or `355_5_bugs_integrity.md` exists, read it and
  cite it rather than re-deriving.

## Deliverable

`research/multiagent/355_7_review_platform.md` — the ONLY file you write. Structure:

1. **Method** — exact commands (incl. targeted `node --test --test-reporter=tap <file>` runs).
2. **Precedence matrix** — the four cases × three surfaces, verified/failed, with the command.
3. **DeepSeek contract conformance** — one row per call site.
4. **Findings** — `id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`.
5. **What is genuinely sound** — with evidence (required).
6. **What I could not verify.**
7. **Recommended owners** for each P0/P1 (Wave 1 `conduit-model` / `mender` / a later lane).

## Evidence bar (non-negotiable)

Every finding cites `file:line` **and** the command or read that produced it. Where a doc and the bytes
disagree, the bytes win. Never print a secret value — report a tail or a shape and say you redacted.

## Do not

- Do not edit any product file, doc, the register, or another lane's report.
- Do not run `npm test`, `npm run build`, `gate.sh`, or a keyed LLM call. Targeted per-file runs only.
- Do not run any git command that writes.
