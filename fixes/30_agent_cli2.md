# 30 — CLI design/diagram/artifacts subcommands landed (agent #4: headless CLI + wiring)

**Status:** `design`, `diagram`, `artifacts` are LIVE in `scripts/rapidtool-cli.mjs`
+ `src/lib/headless.ts`. Full E2E driven end-to-end on Windows (Node v22.23.2).
Design/diagram modules landed mid-task (see ⚠ at the bottom). This file is the
agent-facing contract for the CLI JSON shapes — code against these EXACT shapes.

## New headless exports (src/lib/headless.ts — appended section)

Written against the sibling modules' frozen surfaces using the vault pattern
(non-literal-specifier dynamic import + runtime probe; typecheck stays green
while the modules are mid-flight):

```ts
export type DesignTokens = Record<string, unknown>;          // opaque JSON object
export const DIAGRAM_KINDS = ["phases", "architecture", "flow"] as const;
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

export function designModuleAvailable(): boolean;            // existsSync probe
export function diagramModuleAvailable(): boolean;

export async function designTokens(project: Project): Promise<DesignTokens>; // design.ts passthrough
export async function designHtml(project: Project): Promise<string>;         // design.ts passthrough
export async function buildDiagram(project: Project, kind: string): Promise<string>; // diagram.ts passthrough; unknown kind → throw
export function listArtifacts(project: Project): ArtifactLite[];             // pure, module-free
export type ArtifactLite = { id: string; phase: PhaseId; kind: ArtifactKind; title: string; bytes: number };
```

Drift guards (throw readable "contract drift" errors, never crash mid-JSON):
`designTokens` must return a non-null non-array object; `designHtml` /
`buildDiagram` must return a non-empty string. Kind whitelist is enforced in
headless BEFORE the sibling module is touched.

## CLI contract (exact JSON, single object per command)

```
design   --project <file.json> [--html <out.html>]
  → exit 0: { "ok": true, "tokens": { …design.ts tokens, opaque… }, "htmlWritten"?: "C:\\…" }
  tokens always inline; htmlWritten only with --html. Module absent → {ok:false,error}, exit 1.

diagram  --project <file.json> --kind phases|architecture|flow [--out <file.svg>]
  → exit 0: { "ok": true, "kind": "phases", "bytes": 8137, "svgWritten"?: "C:\\…" }
  bytes = UTF-8 length of the SVG. Without --out the SVG is not printed (stdout purity).
  Bad kind → exit 1: { "ok": false, "error": "buildDiagram: unknown kind … — expected one of phases | architecture | flow." }

artifacts --project <file.json>
  → exit 0: { "ok": true, "count": 18, "items": [ { "id", "phase", "kind", "title", "bytes" }, … ] }
  Stored (chronological) order; bytes = UTF-8 length of artifact body. Bodies NOT
  included — fetch via `export` / `packet`. Pure projection, works even while
  design.ts/diagram.ts are absent.
```

Verified live against a fully-drained project (HVAC Dispatch, 13/13 phases,
18 artifacts, vault 46 notes): design `{ok:true, tokens:{palette,typography,
spacing,radius,shadows}}` exit 0; design --html wrote 22,574-byte page;
diagram phases 8,137 B / architecture 9,629 B / flow 3,747 B all exit 0;
artifacts 18 rows. Programmatic one-JSON check (JSON.parse over full stdout)
PASSED for all 17 command/error-path combinations incl. crew/verify
not-configured exits. NOTE: export stdout is ~57 KB — fine via file/pipe, but
any Windows argv-capured test harness truncates at ~32 KB (harness bug, not CLI).

## E2E (this round, deterministic, no keys)

create → gate --autopilot → approve ×4 (P4/P5/P8/P9 stock gates park) → gate →
complete (P12). summary, vault --out (46 notes + _index.md), search
("isolation" → 6 hits), packet --out (8,811 B), export, crew/verify
(not-configured, exit 1, single JSON) all unchanged and green.

## ⚠ Open item for the design agent (DO NOT fix from here — ownership)

`npm run typecheck` reported ONE error mid-task in the sibling file
`src/lib/design.ts(578,53)`: TS7053 — `TOKEN_ROLE[key]` inside `designHtml`'s
`swatchCell`, where `key: string` cannot index
`Record<"warn"|"ok"|"bg"|…, string>` (TOKEN_ROLE's keys are the fixed 20).
**RESOLVED by the design agent at ~00:43** — final typecheck this round is
0 errors repo-wide (headless.ts, rapidtool-cli.mjs, all tests clean).

## ⚠ Notes for the orchestrator

- `diagram.test.ts` is referenced by diagram.ts's header but was not on disk at
  task end; `design.test.ts` exists (52/52 passes standalone) but is NOT in
  package.json's mandated test command. If the mandated command is expected to
  cover them, update `npm test`'s src test list accordingly.
- Mandated `npm test` run this round: 185 pass / 10 fail — all 10 failures are
  PRE-EXISTING environment noise in Sep-4 files untouched this round, none of
  which import headless.ts or rapidtool-cli.mjs:
  - 3× symlink EPERM (`check-auth-invariant.test.mjs` ×2, `with-app-env.test.mjs`
    ×1) — Windows needs Developer Mode/admin for `symlinkSync`; not code.
  - 7× og platform-chrome assertions in `grok-pwa-plugin.test.mjs` (og:title
    overwrite, og:image emission, no-head injection, case-insensitive `</HEAD>`,
    title-tag app name). Subsystem untouched this round (Sep 4 files).
- E2E droppings left in repo root for inspection: `build.json`,
  `design-e2e.html`, `phases-e2e.svg`, `arch-e2e.svg`, `flow-e2e.svg`,
  `packet-e2e.md`, `vault-e2e/`. Delete freely.
- README-cli.md now documents all 16 subcommands with exact JSON examples
  (Design/Diagram/Artifacts sections added; agent-loop and writer notes updated).
