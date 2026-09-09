# 39 — E-15 scaffold emitter + E-27 shipped-artifact pass landed (src/lib/scaffold.ts)

**Status:** `src/lib/scaffold.ts` + `src/lib/scaffold.test.ts` are LIVE. Deterministic
+ zero new deps + pure (no fs, no `Date.now()`). scaffold.test.ts: **26 tests, 0 fail**
under `node --experimental-strip-types --test src/lib/scaffold.test.ts`.
NOTE: `package.json`'s `test` script is still the E-05 explicit list — this suite is
not wired into `npm test` yet; append `src/lib/scaffold.test.ts` when E-05 lands.

## Exact export surface (src/lib/scaffold.ts) — compile against these

```ts
export type ProjectKind = "webapp" | "cli-tool" | "library" | "game" | "service";
export type ScaffoldFile = { path: string; body: string };
export type ScaffoldResult =
  | { ok: true; files: ScaffoldFile[]; summary: string }
  | { ok: false; error: string };

export function projectKindOf(project: Project): ProjectKind;
export function scaffoldProject(project: Project): ScaffoldResult; // pure; CLI writes the files
export function deplyNotes(project: Project): string;              // DEPLOY.md content
export const DEPLOY_HONESTY_STAMP = "> template derived from P9/P12 artifacts — verify credentials before any deploy";
```

## Semantics the CLI (`emit` / `ship-notes`) can rely on

- **File tree (deterministic order):** `README.md`, `DEPLOY.md`, `.env.example`,
  `package.json`, `tsconfig.json`, `.rapidtool/project.json` (byte-identical to
  `io.exportProjectJson`), then `assets/manifest.json` ONLY for game kind, then
  spec-graph modules in topo `order` (`schema` → domain types from A6 entities/fields,
  `api` → `ENDPOINTS` skeleton, `store` → checkpoint stub, `job-N` → TODO stub naming
  its `# orc-*` oracle rows, `ui` → kind-appropriate shell), then
  `tests/oracle.spec.ts` (A7 rows as `{todo:true}` pinned stubs).
- **generatedSource hosting:** the machine-verified P6 module is embedded VERBATIM on
  the first `job-*` node's file (fallback `src/generated.ts` when no job node exists).
  It is never duplicated onto other job nodes (those stay honest TODO stubs).
- **Kind resolution:** `Project.kind` (types.ts, coarse `"app"|"tool"|"game"`) maps
  app→webapp, tool→cli-tool, game→game; when absent, register E-15 keyword inference
  runs over brief/domain/lattice jobs (**word-token matching** — `"TypeScript"` must
  not hit keyword `script`, `"build"` must not hit `ui`), default webapp.
- **Escaping:** all paths sanitized (no `..`, whitelist `[A-Za-z0-9_./-]`, unsafe node
  files fall back to `src/generated/<node-id>.ts`); package `name` = `io.slugName`;
  code inserts go through `ident()`/`pascal()`/JSON-stringify; comments/markdown get
  single-line collapse; JSX name renders via `{"…"}` expression (never raw JSX text).
- **No secrets:** `.env.example` is CONSTANT per kind (`/^[A-Z_]+=PLACEHOLDER$/` rows),
  never derived from project text; DEPLOY.md is composed from P9/P12 artifacts + kind
  defaults only (never memory/brief text).
- **Honest framing (E-27):** every DEPLOY.md carries `DEPLOY_HONESTY_STAMP`, states
  "No deployment is configured…", embeds P9 workflow/IaC + P12 ADR/OpenAPI artifact
  bodies verbatim under fences captioned "recorded — never executed", and documents
  the asset boundary: `assets/` + `public/` are expected at the scaffold and are NOT
  engine-generated (game: `assets/manifest.json` placeholder roster, `status:"placeholder"`).

## Coordination notes for siblings

- **types.ts now (01:30 sibling edit):** `Project.kind?: "app"|"tool"|"game"` landed and
  `Project.scorecard` was REMOVED — dod/packet/vault/engine/console were mid-repair at
  handoff (tsc errors in THOSE files only; nothing in scaffold.ts). Scaffold reads no
  `scorecard` and compiles clean against the new shape.
- `emitScaffold(project, dir)` disk-writing lives in the CLI layer, per E-15 #2 — this
  module intentionally returns `{path, body}[]`.
- Suite count: 26 tests across kind mapping/inference, per-kind tree shape, generated-
  source hosting, determinism, hostile-input escaping, secret-free env, DEPLOY honesty.
