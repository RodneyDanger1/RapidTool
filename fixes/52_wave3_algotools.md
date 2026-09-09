# 52 — Wave 3: algorithm + architecture tool modules landed (src/lib/algo-tools.ts, src/lib/arch-tools.ts)

**Status:** both modules + suites are LIVE. The `npm test` glob (`src/lib/*.test.ts`)
picks both suites up automatically — no package.json change. **algo-tools.test.ts:
19 tests, 0 fail · arch-tools.test.ts: 10 tests, 0 fail (29/29).** Zero new deps,
zero imports of LLM/fs/network in the static halves; keyed halves call
`completeDeepSeek` (flash, json:true) exactly like `verify.server.ts generateCases`.
Coverage: register G-27/G-28/G-29 (algorithm tools) + G-30-narrow/G-32 (+ G-33-narrow
codebase map without ts-morph), implemented per the feasibility corrections in
`research/multiagent/15_feasibility_review.md` (fast-check/madge/dep-cruiser/ts-morph
all replaced by hand-rolled equivalents; G-30 graphviz correction honored).

## Exact export surface — compile against these

### src/lib/algo-tools.ts
```ts
export type AlgoSpec = { name: string; steps: string[]; complexity: string; edgeCases: string[] };
export type AlgoSpecResult =
  | { ok: true; algorithm: AlgoSpec }
  | { ok: false; reason: "not-configured" | "error"; error?: string };
export type PropertyCasesResult =
  | { ok: true; cases: VerifyCase[] }                        // VerifyCase from verify.server.ts
  | { ok: false; reason: "not-configured" | "error"; error?: string };
export type ComplexityNotation = "O(1)" | "O(log n)" | "O(n)" | "O(n log n)" | "O(n^2)" | "O(n^3)";
export type ComplexityReport = {
  notation: ComplexityNotation; loops: number; maxNesting: number; halvingLoops: number;
  lineRefs: number[]; caveat: string;
};
export function parseAlgorithmSpecJson(text: string): AlgoSpec | null;   // pure, fence-tolerant
export function exportedNamesOf(source: string): string[];                // pure
export function maskNonCode(source: string): string;                      // pure lexer (strings/comments/templates/regex masked)
export async function specToAlgorithm(spec: string, brief: string): Promise<AlgoSpecResult>;
export async function propertyTestsFor(source: string, brief: string): Promise<PropertyCasesResult>;
export function complexityOf(source: string): ComplexityReport;           // pure + deterministic
export function benchmarkHarness(source: string, brief: string): string;  // pure + deterministic
export const COMPLEXITY_CAVEAT: string;
```

### src/lib/arch-tools.ts (self-contained: zero imports, pure, keyless)
```ts
export type ScaffoldFileLike = { path: string; body: string };
export type DepNode = { id: string; path: string };
export type DepEdge = { from: string; to: string };
export type DependencyGraph = { nodes: DepNode[]; edges: DepEdge[] };
export type LocalImportRef = { spec: string; line: number };
export function scanLocalImports(body: string): LocalImportRef[];
export function canonicalModuleId(path: string): string;
export function resolveRelativeImport(fromPath: string, spec: string): string;
export function dependencyGraph(files: ScaffoldFileLike[]): DependencyGraph;
export function adrRecord(title: string, context: string, decision: string, consequences: string): string;
export type CodebaseInput = { name?; brief?; kind?; domain?; artifacts?; generatedSource?; scaffoldFiles? };
export function codebaseMap(project: CodebaseInput): string;
```

## Semantics the caller can rely on (READ)

- **specToAlgorithm** — keyless → `{ok:false, reason:"not-configured"}` before any
  network (never fabricates). Keyed: flash + `json:true`, parsed by
  `parseAlgorithmSpecJson`; unparseable reply → honest `reason:"error"`.
- **propertyTestsFor** — returns **VerifyCase-shaped** cases parsed by the SAME
  parser the verify lane runs (`parseOracleJson` from verify.server.ts), so the
  case contract is shared by construction. The LLM is instructed to emit
  property-style invariants as single boolean expressions over fixed inline
  samples (fast-check is not injectable in the bounded runner child — 15_feasibility
  correction). Export names are surfaced honestly into the prompt
  (`exportedNamesOf`).
- **complexityOf** — honest loop-shape heuristic over a quote/comment/template/
  regex-aware lexed view (`maskNonCode`, exported for tests): brace-stack loop
  nesting, halving probes (`>>1`, `>>=1`, `>>>1`, `/ 2`, `/= 2`, `0.5`) from the
  loop header + own body head (stops at first nested block so an outer loop is
  not misread through its inner loop). `caveat` always says: heuristic, not a
  proof; recursion/callbacks/stdlib not modeled. Byte-deterministic.
- **benchmarkHarness** — returns a runnable node:test FILE BODY (ESM, zero-dep,
  `performance.now()`, mulberry32 seeded inputs; header carries the brief +
  complexityOf claim). Deterministic: same (source,brief) → byte-identical.
  Proven by a test that WRITES the body to a temp dir and executes it under
  `node` (exit 0, `BENCH <name> <ns>/op` row present).
- **dependencyGraph** — relative-import scan only (register rule scope): `./` and
  `../` string-literal specifiers after `from`/`import(`/`require(`; comments,
  template literals and string contents never produce edges; bare/external
  specifiers (`react`, `node:fs`, `@/alias`) are out of scope. Self-imports
  dropped, duplicates collapsed, ids canonical (extensionless, `\`→`/`), edges to
  relative targets missing from the file set are kept (dangling is honest data,
  rules decide later). Nodes/edges sorted → byte-stable JSON.
- **adrRecord** — pure ADR markdown (`# title` / Context / Decision / Consequences
  with bulleted consequences; multi-line strings become bullets; empty
  consequences → `- (none recorded)`). NO dates/ids — numbering and file naming
  are the caller's job. Empty title/context/decision throw TypeError (usage error).
- **codebaseMap** — deterministic markdown map (name/kind/domain/brief line +
  artifact table sorted by (phase, id) + generatedSource LOC + scaffold-file table
  with LOC and resolved local imports). wc-style LOC (trailing newline terminates
  the last line). Pipes in cells escaped. Empty sections omitted. A full
  types.ts `Project` is structurally compatible with `CodebaseInput`.

## Register traceability
- G-27 → `specToAlgorithm` (keyed synthesis) + `benchmarkHarness` (static emitter).
- G-28 → `propertyTestsFor` (fast-check-free property cases, shared VerifyCase contract).
- G-29 → `complexityOf` (static metrics heuristic; a later wave wires it as gate probe + CLI verb).
- G-30-narrow → `dependencyGraph` (hand-rolled scanner per the graphviz/materialization correction).
- G-32 → `adrRecord` (pattern-only ADR body; mint/list/write layer is the CLI/headless caller).
- G-33-narrow → `codebaseMap` (ts-morph-free map, C-1-safe in-memory input).

## Gates
- `npm run typecheck`: my 5 files contribute 0 errors (repo-wide transient red:
  3 errors inside sibling-owned in-flight files `src/lib/vector.ts`,
  `src/lib/vector.test.ts`, `src/lib/crew.test.ts` — wave-3 agents W1/W2 territory).
- `npm run test`: `algo-tools` + `arch-tools` 29/29. src/lib leg 697/702 — the 5
  failures are all in sibling-owned `vector.test.ts` (in-flight, not mine).
  Scripts leg 185/195 — the 10 are the PRE-EXISTING Windows symlink/EPERM
  baseline documented in fixes/42 and fixes/47 (og:title/symlink cases), none new.
- `npm run build`: exit 0.
- No package.json / tsconfig / vite changes; suites auto-discovered by the test glob.
