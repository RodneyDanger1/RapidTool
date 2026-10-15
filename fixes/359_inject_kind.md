# 359 · lane `inject-kind` — the delivery kind inside the prompts that shape the product

**Wave:** W359 (kind fidelity). **Lane:** `inject-kind` (persona `quill`). **Repo:**
`C:\Users\mnril\Desktop\RapidTool Main`. **Host:** Node v24.15.0, Windows PowerShell 5.1.
**Plan:** `wave_plans/W359/inject-kind.md` + `wave_plans/W359/README.md`. **Source measurement:**
`research/multiagent/358_cartographer.md` §3.2 and `research/deepseek-api.md` §4/§5. **Append-only; this
lane is its only writer.**

**Owned files:** `src/lib/codegen.server.ts` · `src/lib/codegen.server.test.ts` ·
`src/lib/prompt-engine.ts` · `src/lib/prompt-engine.test.ts`.

**Headline:** The resolved kind now rides **both** prompts, as prompt TEXT. `codegen.server.ts` gained a
project-stable `DELIVERY KIND` block (466–516 chars per kind) pushed **into `lines`** right after `BRIEF:`
and before the volatile `TYPE SIGNATURES` block, so it sits in the cacheable prefix the DeepSeek
prefix-cache keys on (`prompt_cache_hit_tokens`, `research/deepseek-api.md` §5) and the prior-files byte
budget counts it; `prompt-engine.ts` renders one `DELIVERY KIND` paragraph beside `Brief:` plus per-kind
REQUIRED field-rule rows. **No seventh envelope key, no change to `ExpandedSpec`'s persisted shape, no
weakening of `expandedSpecViolations`, no keyed call.** Verified: `npx tsc --noEmit` clean;
`codegen.server.test.ts` **331/331**; `prompt-engine.test.ts` **59/59**. The `fixes/341-1` pre-seal pin
that was RED at this lane's baseline (`scaffold.ts`, lane `kind-gate`) is GREEN in my final run because
`kind-gate` landed its fix (mtime 4:57 PM); I never touched that expectation.

---

## 1. JOB 1 · the `DELIVERY KIND` block in `codegen.server.ts`

**Definition** — `DELIVERY_KIND_BLOCK: Record<DeliveryKind, string>` at `codegen.server.ts:2236`, rendered
by the private helper `deliveryKindLines()` at `:2278` (returns `[]` for absent/unknown/`null` kinds, so
every non-kinded call keeps the legacy bytes — the module's established optional-block contract).

**Content per kind** (each block names its own kind on line 1; sizes measured on the bytes):

| kind | chars | mandatory surface the block demands |
|---|---|---|
| `app` | 485 | `index.html` + `src/main.tsx` + the named pages/screens behind a router; loading/empty/error per surface; **no** `requestAnimationFrame` loop, **no** `<canvas>` |
| `tool` | 494 | one entry `main(argv: string[]): Promise<number>`; no DOM/React/browser globals, **no `.tsx` anywhere**; a usage line + ≥2 documented non-zero exit codes; deterministic output (no random id / wall-clock stamp) |
| `game` | 466 | keyboard **AND** pointer input, a `requestAnimationFrame` loop, a `<canvas>` the loop renders into; win/lose (pause/restart) states required and testable; score/level advanced by the loop |
| `library` | 489 | side-effect-free named exports; importing must not start a server/loop/IO; **no `.tsx`, no JSX, no DOM**; one shared `type` for the public data shape |
| `service` | 516 | a long-running entry that reads its configuration (e.g. `PORT`) and listens — a start/listen signature must exist; explicit readiness/shutdown with an honest refusal; no DOM/React/`.tsx`; no fabricated 200 |

**Placement** (`p6SynthesisChunkUserPrompt`, `:2359`): the block is spread into the `lines` array literal at
`:2423` — after the `BRIEF:` line and its brief text, **before** `REQUIREMENTS` and long before the
per-chunk volatile `TYPE SIGNATURES (must export` marker. Measured on the arcade-breakout fixture: block at
index 286, `TYPE SIGNATURES` at 1670 → inside the cacheable prefix. Two chunks of one project share that
prefix byte-for-byte (pinned by test).

**Budget accounting** — `budgetLeft = P6_SYNTH_PROMPT_MAX_CHARS - lines.join("\n").length` (`:2497`) now
measures `lines` **after** the block, because the block is an element of `lines` rather than a string
appended after the join. Proof is not a comment: the new test binary-searches the export-list length at
which the prior-file byte budget elides, then shows the **same** file (which still fits without the kind) is
elided **with** the kind block — i.e. the block consumes `budgetLeft` and moves the `[PRIOR-ELIDED]`
boundary by its own ~0.5 KB, instead of firing early by silently occupying unbudgeted space.

**Call sites** (all four pass `deliveryKindOf(project)` — the ONE resolver, never a re-derivation):
`:7216` (single-module lane), `:7961` (tree chunk), `:8136` (tree repair, ordered), `:8393` (tree repair,
indexed). `p6SynthesisUserPrompt` delegates with the kind at `:2321`.

## 2. JOB 2 · the kind in `prompt-engine.ts` — PROMPT TEXT, never a seventh key

- `DELIVERY_KIND_SPEC: Record<DeliveryKind, {paragraph; rules}>` (`prompt-engine.ts:278`) + pure
  `deliveryKindSpecText()` (`:329`, `[]`/`[]` for absent/unknown kinds).
- `expansionPrompt(brief, policies, lessons, kind)` (`:345`): the kind's **REQUIRED rows** are spliced into
  the field rules (`:410`, immediately after the `- typeSignatures:` coverage rule they constrain) and the
  single **DELIVERY KIND paragraph** is spliced immediately before the `Brief:` line (`:418`), so it governs
  the reading of the brief. `expandBrief(brief, policies?, lessons?, kind?)` (`:510`) forwards it, and the
  one bounded repair re-prompt re-sends the same user message (test-pinned).
- **The per-kind REQUIRED rows** (the wave's four demanded cases, plus `app`):
  - `game` — input/loop/canvas requirements **plus a loop/render signature**:
    `renderFrame(ctx: CanvasRenderingContext2D, dtMs: number): void`, the input handler and the state-reset
    signature; win/lose each a requirement with an observable condition.
  - `tool` — `main(argv: string[]): Promise<number>` (the returned number IS the exit code) **plus the
    exit-code edge cases** (missing/unknown flag, unreadable input, partial failure) in
    edgeCases/errorHandling, and a usage-line requirement.
  - `service` — a **listen/readiness signature**
    `startServer(port: number): Promise<{ url: string; close(): Promise<void> }>`, explicit readiness
    refusal, and honest failure responses per inbound path.
  - `library` — an importable public API (named exports with explicit parameter/return types + one exported
    shared `type`) **and a JSX prohibition** (no JSX/.tsx, no listen entry, no import-time side effects).
  - `app` — a signature per user-facing surface, the navigation path, and an explicit "do NOT plan an argv
    entry, a listen/readiness entry or a `requestAnimationFrame` game loop".
- **No seventh key:** the six-key reply contract line, `EXPANDED_SPEC_KEYS` (6), `expandedSpecViolations`
  and `ExpandedSpec` are untouched; the prompt never asks for a `deliveryKind` key (pinned by test). A kind
  changes what the model is *asked to write*, never what it may return — so cached `implementationSpec`
  rows and the persisted shape are unchanged.
- **Byte-identity:** omitted/`null`/unknown kind ⇒ byte-identical legacy prompt (pinned).

## 3. JOB 3 · the `P6SynthesisDeps.expand` seam widening

- `codegen.server.ts:6077` — `expand: (brief, lessons?, kind?: DeliveryKind | null) =>
  Promise<ExpandBriefResult>`: **trailing** optional, so every existing seam assignment (1-arg, 2-arg, and
  the `codegen.server.test.ts:3179` fixtures) stays assignable and compiles unchanged (proved by
  `npx tsc --noEmit`, which typechecks those seams).
- `defaultDeps` (`:6307`) — `expand: (brief, lessons, kind) => expandBriefWithBackoff(brief, (b) =>
  expandBrief(b, undefined, lessons, kind))`.
- The single production call (`:7108`) passes `deliveryKindOf(project)`, so the expansion prompt for a
  `game` brief is asked for input/loop/canvas requirements even when the brief is unstamped at the record
  level.

## 4. JOB 4 · the two measured prompts for `arcade-breakout` (keyless, from the bytes)

Fixture: the corpus brief verbatim (`research/eval-corpus/arcade-breakout.md`, which declares
`kind: "game"` — what the eval driver stamps). Resolved kind (`engine.deliveryKindOf`): **`game`**, both
from the declared field and, after lane `resolve-kind` landed, from the brief alone. No keyed call: the
expansion measurement is served by an in-script `fetch` double (a test seam, never a production path).

**Synthesis prompt** (`p6SynthesisUserPrompt(ARCADE_BRIEF, spec, [], undefined, undefined,
deliveryKindOf(project))`) — 1 960 chars with the kind vs 1 492 without; headroom 58 040 under
`P6_SYNTH_PROMPT_MAX_CHARS = 60_000`; `BRIEF:` at 0 → `DELIVERY KIND:` at 286 → `TYPE SIGNATURES` at 1670:

```
BRIEF:
A browser arcade game for players: … — canvas only.

DELIVERY KIND: game (a playable game).
This project is a GAME — the whole tree must honour it: a game is not a CRUD app and not a static site.
- Surface (mandatory): keyboard AND pointer input, a requestAnimationFrame game loop, and a <canvas> the loop renders into.
- Win/lose (or pause/restart) states are required behaviours, each reachable and testable.
- Score/level state is advanced by the loop; never ship a form-over-tables page instead of the game surface.

REQUIREMENTS (…):
```

**Expansion prompt** (`expandBrief(ARCADE_BRIEF, undefined, undefined, "game")`) — 3 686 chars; the
`DELIVERY KIND` paragraph at index 3 110, `Brief:` at 3 402 (paragraph immediately beside the brief); the
six-key contract line intact; `deliveryKind` never asked for; only the `game` paragraph on the wire
(`app`/`tool`/`library`/`service` all absent — checked by test). The three REQUIRED rows, verbatim:

```
DELIVERY KIND: game — a playable game. Spec it as a game, never as a CRUD app or a static site: player input, the game loop, the canvas it draws into, and the win/lose states the player reaches. Requirements and signatures that only describe forms, lists and tables are wrong for this brief.
- REQUIRED (game): requirements MUST cover the player input (keyboard AND pointer/touch), the game loop (a per-frame update plus render), and the <canvas> surface the loop draws into.
- REQUIRED (game): the win and lose (and pause/restart) states MUST each appear as a requirement with a condition a test can observe; a score/level requirement MUST say how it advances.
- REQUIRED (game): typeSignatures MUST include the loop/render entry, e.g. "renderFrame(ctx: CanvasRenderingContext2D, dtMs: number): void", alongside the input handler and the state-reset signature.
```

End-to-end wiring is also pinned through the REAL functions (keyless, injected LLM seams = test doubles in
the test seam): the arcade project with `kind: "game"` routed to the chunked tree carries the game block on
**every** assembled chunk prompt (`liveP6Synthesis`), and a `library` project on the single-module lane
carries the library block — so the kind is proven to reach the prompts from the call sites, not only from
the builders.

## 5. The `headless.ts` need I reported (not edited — `thread-kind`'s file)

`headless.ts` `promptExpand(project, policies)` called `expandBrief(b, policies)` with no kind. The need
was: pass the resolved kind through — `expandBrief(b, policies, undefined, deliveryKindOf(project))`.
**Lane `thread-kind` has already landed exactly that** (their §3): `headless.ts:6457` now reads
`expandBrief(b, policies, undefined, deliveryKindOf(project))`, credit-commented to this lane. I verified it
against my new 4th parameter rather than editing their file. No outstanding `headless.ts` need remains; there
are no other production callers of `expandBrief` (verified by a repo-wide search).

## 6. Verification (keyless; every command run in this lane)

| command | result |
|---|---|
| `npx tsc --noEmit` (final) | **clean, 0 errors** |
| `node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts` | **331/331 pass, 0 fail** (baseline: 325 tests, 1 fail) |
| `node --experimental-strip-types --test --test-reporter=tap src/lib/prompt-engine.test.ts` | **59/59 pass, 0 fail** (baseline 54/54) |
| sibling suites importing `codegen.server.ts` (`acceptance`, `dod`, `verify.server`, `maker-score`, `wild-step`, `headless`) | see §7 |

New pins added: 6 in `codegen.server.test.ts` (block-per-kind content; placement + cacheable prefix +
absent-kind byte-identity; the `budgetLeft` boundary proof; the arcade-breakout assembled prompt; the real
chunked call site; the real single-module call site) and 5 in `prompt-engine.test.ts` (per-kind paragraph +
rows on the wire with no cross-kind leak; the per-kind REQUIRED contract; legacy byte-identity for
absent/`null`/unknown kind; no seventh key + unchanged strict check; the repair re-prompt carries the kind).

## 7. Transient red, cross-lane notes, and one self-inflicted incident I must disclose

1. **The RED pin at my baseline is `kind-gate`'s, and it went GREEN on its own.** At my first full run
   `fixes/341-1 pre-seal self-typecheck gate → BEFORE (the measured defect)` failed with
   `TS17004/TS6142 … --jsx is not set` — the `scaffold.ts` kind/JSX defect the brief told me not to
   "fix" by expectation. `scaffold.ts` was rewritten at **4:57 PM** (lane `kind-gate`); my final run has
   that suite, and all 331 tests, green. I never edited the expectation, `scaffold.ts`, or any other lane's
   file.
2. **Self-inflicted transient red — my own encoding accident in `codegen.server.test.ts`, disclosed in
   full.** My first append of the new test block used `Get-Content -Raw` + `Set-Content -Encoding utf8`,
   which in PowerShell 5.1 reads the file as ANSI and writes a BOM: every non-ASCII byte in the pre-existing
   file (1398 of them: `—`, `→`, `≥`, `§`) became double-encoded (`â€"`) and all line endings became CRLF.
   That produced 38 spurious failures across *other* suites on the next run — all of them strict comparisons
   whose "expected" side was the mangled constant. I diagnosed it (mtime/encoding: 248 mojibake lines, CR on
   every line, 603/409 diff lines), restored the file **byte-faithfully** from the HEAD blob
   (`git show HEAD:…`, no git write) and re-appended only my new block with LF/UTF-8-no-BOM tooling, then
   normalized the file's EOLs back to CRLF to match its pre-session on-disk state and its sibling test files.
   Post-repair: 0 mojibake lines, `git diff --numstat` = **191 insertions / 0 deletions**, and the 38
   failures vanished (they were never real). No production file was ever affected.
3. **Other lanes' files, attributed by mtime** (I edited none of them): `scaffold.ts` 4:57 PM (`kind-gate` —
   the 341-1 pin), `engine.ts` 5:03 PM (`resolve-kind` — with which `deliveryKindOf` now resolves the
   arcade-breakout brief to `game` from the brief alone, not only from the declared field), `headless.ts`
   (`thread-kind` — the `promptExpand` pass-through, plus the `TS1064` error I saw in one mid-flight tsc run
   at `headless.ts:995`, which is gone in the final clean run).
4. **Unverified / residual:** (a) the effect of the block on a real keyed run is by construction a prompt
   change only — not measured, no key spent; (b) `prompt_cache_hit_tokens` improvement is a placement
   argument (block is project-stable and inside the leading prefix), not an API-observed number; (c) the
   per-kind REQUIRED rows are prompt text — whether a given model obeys them is a run-side question this
   lane cannot answer keyless; (d) `scripts/run-eval.mjs`'s kind mapper (lane `resolve-kind`/`kind-corpus`)
   still decides whether `library`/`service` corpus rows reach the tree with a kind.
