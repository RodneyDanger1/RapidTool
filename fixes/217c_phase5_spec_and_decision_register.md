# fixes/217c — Phase 5 spec, product-decision register, isolation-boundary input, competitor-gap refresh

**Task:** RapidTool W11 · LANE 3 (Researcher). Docs-only. No `src/` or `scripts/` edits.

**Status: COMPLETE** (skeleton written first, per lane-3.md item 1; content verified 2026-09-24).

Sections (numbered per the lane plan):

1. Scope + method + commands-run ledger (filled at the end)
2. Phase 5 (T5.1–T5.7) runnable spec — verified `file:line` + done-when + tests + file ownership + size
   - 2.1 T5.1 streaming
   - 2.2 T5.2 review UI
   - 2.3 T5.3 eval verb
   - 2.4 T5.4 provenance fields
   - 2.5 T5.5 plugins
   - 2.6 T5.7 cassette
   - 2.7 Tasks proven DONE-today (if any)
3. Product-decision register (T5.6, T5.8 — USER-owned; stated, not decided)
4. Isolation-boundary decision input (108-T7 / T-107.8) — probe SETTLED 2026-09-24: **NO isolator on this host** (docker/bwrap absent, exit 127; WSL 0 distros) → Outcome 2 is the only available branch (see §4's drop-in slot + `fixes/217b` §2)
5. Competitor-gap refresh (honest table)
6. Priority ranking (by distance closed on the maker test)
7. Self-check + commands-run ledger

---

## §0 — Scope, method, and how to read this document

**Status: COMPLETE.** Written 2026-09-24 (W11 dispatch day). Docs-only: no `src/`, no `scripts/`
edits; no git mutations; no test/build/typecheck runs (machine is memory-tight; siblings are
mid-edit).

**What this document is.** The runnable spec for Phase 5 (T5.1–T5.5, T5.7) of
`research/multiagent/104_factory_upgrade_plan.md` §5 — each task with a CURRENT `file:line` I
verified by reading the file today (command output pasted in §7), a done-when, the test command,
the files a lane would own, and an honest size. Plus the USER-owned product-decision register
(T5.6/T5.8), the isolation-boundary decision input (108-T7 / T-107.8), and a refreshed
competitor-gap table.

**Verification method.** Every anchor below was produced by a command in this session; the full
ledger is §7. Where a dossier anchor has gone stale, I say so and give the real one. Where I
could not determine something, it says **"UNKNOWN — needs X"** and names X; nothing is guessed.

**Anchor-drift warning (read before trusting any line number).** W11 lanes are editing files
concurrently: L1 owns `compile-check.server.ts`, L4 owns `headless.ts` + `rapidtool-cli.mjs`,
L5 owns `engine.ts`, L6 owns `console.tsx`. All anchors below were verified **today** in the
live tree, but line numbers in those four files may drift as siblings land. Per the `fixes/216x`
§2.2 precedent, **the symbol name is the stable reference; the line is the address at this
hour.** A lane must re-grep its anchor before editing.

**One documented stale-anchor example (found again today).** `104:563`/dossiers cite the chat
stream flag as `deepseek.server.ts:233` `stream: false`. Today `src/lib/deepseek.server.ts` is
**39 lines** (§7 cmd 8) — a thin re-export — and the real line is
`src/lib/llm/providers/deepseek.ts:377` `stream: false` (cmd 9). Similarly the chat context cap
cited as `chat.server.ts:48` = 2500 chars is now `chat.server.ts:53` = **3200** (cmd 10).

---

## §1 — Phase 5 (T5.x) — the runnable spec

Source of the task list: `104_factory_upgrade_plan.md:610-616` (Phase 5 row, verified today —
cmd 4) and `taskuniverselog.md:285` ("T5.1–T5.8 ❌ … 0/8 … ≈25–55 eng-days"; T5.6/T5.8 are
product decisions, not engineering tasks). The dossier-level detail for each item lives in
`103_feature_gaps.md` §3 (A6/A10/A15/A16/A18/A8 rows — cited per task); those rows are the
"dossier anchor" below.

### T5.1 — Streaming output (SSE to the console + NDJSON to the CLI)

**Dossier anchors.** `104:612` ("T5.1 streaming (SSE to console + NDJSON to CLI; zero today)");
`103_feature_gaps.md:174` (A6 — chat.server.ts stream API, src/routes + console.tsx chat tab,
rapidtool-cli.mjs NDJSON stream mode, README); `94_readiness_plan.md:163-168` (§G2 "Streaming
chat + stop button" with its acceptance sentence); `90_LEAPFROG.md:166` (shortcoming row 1);
`93_design_flaws.md:33,162` (DF-12).

**CURRENT anchors (verified today, outputs in §7).**
- `src/lib/chat.ts:19` — `const chatServer = createServerFn({ method: "POST" })`; `:28` calls
  `chatOnceServer(...)`. The one-shot transport (cmd 20).
- `src/lib/llm/providers/deepseek.ts:377` — `stream: false` (cmd 9). This is the only stream
  flag in `src/`; the dossier's `deepseek.server.ts:233` is stale (that file is 39 lines now).
- `grep -rn "text/event-stream|EventSource" src/ scripts/` → ONE hit, `src/lib/sandbox.ts:316`,
  which is a stub-list string inside generated sandbox content — **not** an SSE path (cmd 6).
  Zero streaming today, confirmed.
- `src/components/console.tsx:5333` — `async function send(...)`, the chat send path; the honest
  liveness ticker ("dead pulse replaced… never ambiguous during a one-shot send") sits at
  `:5254-5255` (cmd 21).
- `src/lib/chat.server.ts:53` — `CHAT_CONTEXT_MAX_CHARS = 3200` (cmd 10).

**What exists today.** One-shot chat with deterministic grounding, an honest liveness ticker,
a context meter server fn (`chat.ts:37` `chatContextServer`), typed failure envelopes
(`chat.server.ts:40` `reason: "not-configured"` — cmd 25). The CLI prints one JSON object per
verb and has no stream mode.

**Exactly what is missing.** (1) A backend stream mode for chat (chunk transport + typed
chunk parser + abort path). (2) A client consumer in ChatPane rendering chunks incrementally,
with a Stop button (AbortController). (3) Persistence of an aborted streamed turn as a coded
display row (94:168's acceptance says a coded abort row; nothing like it exists). (4) NDJSON
stream mode for long-running CLI verbs. (5) Doc updates (README + README-cli) — and because
`scripts/README-cli.test.mjs` binds the verb list (cmd 34), any verb-surface change must keep
that test green.

**The transport question is NOT settled here.** `@tanstack/react-start` is pinned `^1.168.0`
(`package.json:51`, cmd 30). Whether that version streams responses through a server function
in this setup is **UNKNOWN — needs a small spike** (or its docs) before the lane commits to a
transport (SSE vs chunked NDJSON vs a route handler). Design reference already on disk:
`fixes/99` §2 carries the bounded typed-stream design + interim plan (cited by `94:164`).

**Done-when (proposed; the lane may refine the transport name, not the outcomes).**
1. Console: tokens appear incrementally in ChatPane for a keyed send; Stop aborts within the
   turn; the abort persists as a display row with a coded error (never replayed as model
   speech — `types.ts:399-400` replay law, cmd 26).
2. Keyless path byte-unchanged: `{ok:false, reason:"not-configured"}` (chat.server.ts:40).
3. CLI: an opt-in NDJSON stream mode for chat/long verbs prints `{"chunk":…}` lines then one
   final envelope; default output for every existing verb is byte-identical; exit taxonomy
   0/1/3/4 unchanged; README-cli updated and `scripts/README-cli.test.mjs` green.
4. Tests: new stream tests beside `chat.server.test.ts`; a scripts-leg test for the NDJSON
   shape. Exact commands: `node --experimental-strip-types --test src/lib/chat.server.test.ts`
   and `node --test scripts/<new>.test.mjs`.

**Files a lane would own.** `src/lib/chat.ts`, `src/lib/chat.server.ts`,
`src/lib/llm/providers/deepseek.ts`, `src/components/console.tsx` (ChatPane),
`scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, plus new test files. Note:
`console.tsx` is W11-L6's file **this wave** — a Phase-5 lane must be assigned it explicitly in
its wave map.

**Honest size.** M (90:166 says M; 94:166 says M–L because of the Stop+p persist half).

**Blast radius.** Chat only. **Do not flip the global default to streaming** — synthesis paths
(`codegen`, `verify`, `crew`) read one-shot envelopes and record usage/provenance from them;
`stream: false` at the provider boundary is the cheap, honest default for those. Stream is a
per-call opt-in. CLI stream mode must not alter the documented "single JSON object on stdout"
contract for non-stream verbs (add a flag; document it; the doc-contract test enforces the
list).

### T5.2 — Review UI: approving diffs / fixture cases

**Dossier anchors.** `104:612-613`; `103_feature_gaps.md:178` (A10 — new console tab + store
actions, diff computation over `importTreeDir` hashes, `brief-fixtures` approve wiring; depends
on A9 hash/diff plumbing + A4); `90:171` (shortcoming row 6, HITL = prose panel); `93:298`
(item 5-adjacent: approvals are CLI/chat only).

**CURRENT anchors (verified today, outputs in §7).**
- CLI half EXISTS: `scripts/rapidtool-cli.mjs:879` `case "fixtures"` — `--draft` builds draft
  cases (`draftBriefFixtures`) and saves `acceptanceBriefHash`; `--approve --ids …` /
  `--approve-all` calls `approveFixtureCases` and sets `acceptanceApprovedAt`; the envelope
  literally says "draft is pending — run fixtures --approve --ids … or --approve-all (never
  auto)" (cmd 11, full body read).
- `src/lib/brief-fixtures.ts` — 767 lines; header doctrine: "the machine DRAFTS, a human
  APPROVES. Every drafted case is born `approval:"pending"`. Nothing … ever flips a case to
  "approved"; only the explicit, human-invoked `approveFixtureCases()` helper does" (cmd 12).
- Console half ABSENT: `grep -in "fixture" src/components/console.tsx` → **zero hits** (cmd 13),
  in a 6050-line file (cmd 14).
- Tab surface today: 10 tabs listed at `console.tsx:135-144` — artifacts, packet, chat, spec,
  crew, oracle, vault, design, diagram, runtime (cmd 22). No review tab.
- `src/lib/store.ts` — zero fixture actions (`grep` empty, cmd 23): approve/reject live in
  engine/server paths; the UI has nothing to call for fixtures.
- Gate meaning: `headless.ts:1928-1954` — the P6 journey converges ONLY when every fixture is
  human-approved; pending fixtures print "never auto-approve" and FAIL the journey; and
  `engine.ts:2343-2351,2416-2424` (cmd 53) — approved fixtures revert to pending on brief-hash mismatch
  (never silently re-approved). Also `headless.ts:3194` carries
  `no human-approved fixtures (decidedBy:"human")` refusal text (cmd 24) — i.e. the seat
  language is already in the machine.
- Diff plumbing that exists: `edit` verb DRY-RUN returns the diff + before/after hashes
  (`rapidtool-cli.mjs:27` doc line, `:1118` case, cmd 15/16); `importTreeDir`
  (`headless.ts:2099`) is a hash-checked re-import (new hash = real edit); `repairTreeDir`
  (`headless.ts` `case "repair"` CLI:1013) re-imports repaired trees.

**Exactly what is missing.**
(a) A console review surface for `acceptanceFixtures`: list cases with approval state, the
red-card reasons, given/expect literals, and per-case + approve-all actions that call the SAME
helper as the CLI (never a second approval path — this is `111 TASK-02`'s stated risk pattern,
mirrored in `console.tsx:360`'s comment).
(b) A diff view for generated-artifact / tree-file changes, computed over `importTreeDir`-
style before/after hashes — applicable to the `edit`/`repair` dry-runs and re-emitted artifacts.
(c) Store actions for both.
(d) An honest "pending fixtures block the P6 claim" banner in the UI (the machine already
refuses; the UI must say why).

**Done-when (proposed).** Half A (fixtures UI): approving one case in the UI flips
`acceptanceFixtures[i].approval` to `"approved"` in the project JSON via `approveFixtureCases`,
sets `acceptanceApprovedAt`, and the CLI `fixtures` envelope over the same file reports it; an
unapproved case can never be bulk-flipped by any UI path; the brief-hash revert rule still
applies. Half B (diff view): `edit --dry-run` output (diff + hashes) is renderable in the UI
for one tree file, read-only, with the same refusal text when the match is ambiguous. Both
halves are separately testable; a lane may land A first.
Tests: `node --experimental-strip-types --test src/lib/brief-fixtures.test.ts` stays green; new
store-action tests under `src/lib/*.test.ts`. **UNKNOWN — needs a decision:** how to test
`console.tsx` itself — today the test command runs ONLY `src/lib/*.test.ts`, `app-data`, `auth`
(`package.json:19`) and there is NO component test file (`src/components/*.test.*` → none,
cmd 29). A lane must either add a DOM test harness or extract the review logic into a pure
module under `src/lib/` (preferred: matches the repo's pure-core/test pattern).

**Files a lane would own.** `src/components/console.tsx`, `src/lib/store.ts`,
`src/lib/brief-fixtures.ts` (only if a UI helper is needed — keep the human-only doctrine),
`src/lib/headless.ts` (only if the diff helper is shared), new test files.

**Honest size.** L (103:178). Half A alone is M.

**Blast radius.** Store shape + approvals. Hard rules: approvals stay human/seat-only
(`policy.ts` is the ONE seam — any new action that writes project state on a human click must
route through `evaluatePolicy`, as the CLI `edit` verb already does at `rapidtool-cli.mjs:1215-1220`,
cmd 16); never add a UI path that sets `approval:"approved"` outside `approveFixtureCases`;
never weaken `headless.ts:1928`'s convergence gate. UI copy must not imply the fixtures ran —
approval is a human act, run evidence is `tree-run`.

### T5.3 — `eval` CLI verb (expose the M1–M9 rubric as an envelope)

**Dossier anchors.** `104:613`; `103_feature_gaps.md:186` (A18, size **S** — "`npm run eval`
exists, but no CLI verb and no envelope; the maker rubric cannot be queried by a driving agent,
so 'score its own runs' is a human step"); `90:242` (Axis-5 item 4 "Eval harness to *prove* the
loop").

**CURRENT anchors (verified today, outputs in §7).**
- The DRIVER exists: `package.json:21` — `"eval": "node --experimental-strip-types scripts/run-eval.mjs"`
  (cmd 32). Header (cmd 31): for every corpus fixture → create → drive the full pipeline
  (keyless deterministic floor by default; `--keyed` = one bounded live entry) → emit →
  `tree-run` → score with the pure rubric → print a table and persist
  `research/eval-out/results.json` (+ `history.json` for M7 priors). Run-side graders live in
  `research/eval-corpus/graders/<slug>.grader.json` and are never handed to the emit path
  (leak-scanned); per case `--trials=N` yields honest pass@k / pass^k / flakiness; results are
  DATA — "the script exits 0 always" (write-up in `run-eval.mjs:1-48`).
- The RUBRIC exists: `src/lib/maker-score.ts:2` — "the PURE M1..M9 maker rubric"; imported only
  by `scripts/run-eval.mjs:60` (`scoreMaker, capabilityCoverage, treeFilesOf`) and its own test
  (cmd 35). `grep "maker" src/lib/headless.ts` and `src/lib/doctor.ts` → **zero hits** — the
  rubric is NOT reachable from any lib seam today.
- The CORPUS exists: `research/eval-corpus/` = **6** fixtures + `README.md` + `graders/` (**6**
  `.grader.json`) (cmd 27) — the fixtures are the owner's real-estate suite family
  (`coffeehouse2home-property-ledger.md`, `house-flip-manager.md`, `real-estate-crm.md`,
  `showing-booking.md`, `rental-portfolio.md`, `field-ops-suite.md`).
- Results exist: `research/eval-out/results.json`, `history.json` + per-slug trial dirs (cmd 28).
- The CLI has **35** verbs (`grep -c 'case "'` = 35, cmd 7) and **no `eval` case**
  (`grep -n '"eval"'` → only `evaluatePolicy` call-sites, cmd 16).

**What exists today.** Driver + rubric + corpus + persisted results, all behind `npm run eval`
(npm script; human step). Nothing an agent driving the CLI can call.

**Exactly what is missing.** An `eval` verb on `scripts/rapidtool-cli.mjs` that runs the driver
(or its scoring path) and returns ONE JSON envelope on stdout per the CLI contract, e.g.
`{ok, cases:[{slug, makerScore, passAtK, flakiness, coverage…}], totals, resultsPath}`.
Exposure seam choice (subprocess the driver vs. export a callable lib entry from
`run-eval.mjs`) is **UNKNOWN — needs a lane design decision**; note the driver currently exits 0
even on red scores and its console table is not machine-shaped.

**Done-when (proposed).**
1. `node --experimental-strip-types scripts/rapidtool-cli.mjs eval [--dir research/eval-corpus] [--limit N] [--trials N]`
   prints exactly one JSON object (parseable with the same discipline as every other verb);
   exit 0 when the run completed (red scores are data, not failure — mirror the driver);
   exit 1 with a coded refusal when the corpus dir is missing/unreadable.
2. Scores equal `npm run eval`'s `results.json` for the same corpus (no second scoring path —
   reuse the driver's scoring code).
3. Keyless by default; `--keyed` remains one bounded entry; no network without key.
4. Docs: verb added to `scripts/README-cli.md`; `node --test scripts/README-cli.test.mjs` green
   (it binds headline verb count + list, cmd 34); a scripts-leg test pins the envelope shape
   with a temp mini-corpus.

**Files a lane would own.** `scripts/rapidtool-cli.mjs`, `scripts/run-eval.mjs` (export a
callable; do not fork scoring), `scripts/README-cli.md`, new/updated `scripts/*.test.mjs`.
(`headless.ts` only if the lane chooses a lib seam — it currently has none.)

**Honest size.** S (103:186).

**Blast radius.** Low and contained to the CLI. Two contracts to respect: the single-JSON-object
stdout contract (README-cli + its doc test) and "results are data" (never turn a red maker score
into exit 1 — that would make the factory look red on purpose-built regression data).

### T5.4 — Artifact provenance fields

**Dossier anchors.** `104:613-614` ("artifact provenance fields (`types.ts:41`)"); `103:183`
(A15, size **S** — "`Artifact` type = id/phase/kind/title/body/language — no
author/provenance/model/actor. Provenance exists only on harvest rows, chat replies and lesson
actor tags; audit trails stop at the project level"); `90:225` (Axis 4).

**CURRENT anchors (verified today, outputs in §7).**
- `src/lib/types.ts:41-47` — `export type Artifact = { id; phase; kind; title; body;
  language? }` — **no provenance fields** (cmd 36). This dossier anchor is still VALID today.
- `src/lib/types.ts:21` — `ModelRoute = "deepseek-flash" | "deepseek-pro" | "deterministic" |
  "none"` (the honest route vocabulary already exists, cmd 36).
- `src/lib/types.ts:187` — the io law already on file: "fails closed on a contradiction, never
  inventing provenance for old rows" (cmd 36).
- `src/lib/types.ts:451` — `ChatLogRow.provenance?: string` — chat rows are the ONLY artifact-
  adjacent provenance today (cmd 36).
- Writers: `src/lib/engine.ts:252` `function art(...)` — the deterministic artifact factory
  (**28** call sites of `art(` in engine.ts, cmd 19) — constructs `{id, phase, kind, title,
  body, language}` with no provenance. LLM-produced artifacts come from
  `codegen.server.ts` (`:2128` `verifyOutcomeArtifact`, `:2181` and `:2948` `codeArtifact`
  literals, cmd 37). Also `engine.ts:1400-1408` (cmd 54) replaces the last artifact on a rejection
  regeneration — a stamping site to check.
- Coercion/filters the new fields must survive: `engine.ts:1992` `wellFormedArtifactRow` +
  `:2183` filter; `io.ts:324,372-373` (artifacts must be an array — cmd 38).
- Renderers: `packet.ts:302` artifacts renderer + `:506` "## Artifacts (trimmed)";
  `vault.ts:336-338` top-10 artifact notes (cmd 39).

**What exists today.** Per-artifact identity (id/phase/kind/title/body/language) only. Route
truth exists in the engine (`ModelRoute`) but is not attached to artifacts; the packet/vault
render artifacts with no "who made this" line.

**Exactly what is missing.** (1) Optional provenance field(s) on `Artifact` (minimum viable
shape: `source: "deterministic" | "model" | "human"`, `modelRoute?: ModelRoute`, plus a source
hash — final shape is a design choice for the lane; keep it optional so old projects load).
(2) Stamping at every writer: `engine.art()` → deterministic; `codegen.server.ts` synthesis
paths → the actual served model id mapped to `ModelRoute` (never a claim the router cannot
support); regeneration at `engine.ts:1400-1408`. (3) Rendering in packet + vault. (4) io.ts
tolerance for absent fields. Completeness of the writer census is **UNKNOWN — needs a lane
grep-census** (I verified 28 `art(` sites + 3 codegen literals; whether crew/verify/headless
write `Project.artifacts` elsewhere was not exhaustively traced).

**Done-when (proposed).**
1. Every artifact in a keyed run carries provenance naming the real producer (model id actually
   served, or "deterministic"); a deterministic artifact can never carry a model stamp; a
   keyless run's artifacts all read "deterministic".
2. `packet.ts` + `vault.ts` render the stamp; old projects (no field) load with no fabricated
   provenance (types.ts:187 law).
3. Tests: `node --experimental-strip-types --test src/lib/engine.test.ts`-class suites for the
   writers + `io` round-trip tolerance; a pinned test that a re-stamped artifact from a
   non-DeepSeek route cannot say `deepseek-*` (mirror the T1.3 acceptance in `104:563`).

**Files a lane would own.** `src/lib/types.ts`, `src/lib/engine.ts`,
`src/lib/codegen.server.ts`, `src/lib/packet.ts`, `src/lib/vault.ts`, `src/lib/io.ts`,
plus tests.

**Honest size.** S (103:183) — the field itself; the writer census makes it S+.

**Blast radius.** `types.ts` is imported everywhere; additive optional fields only. io.ts must
stay tolerant (old exports must round-trip). Do not weaken the existing "never inventing
provenance" law while adding the field — that law is the reason this task is honest.

### T5.5 — Plugin / hook registry

**Dossier anchors.** `104:614`; `103:184` (A16, size **M** — "No `register*`/`addHook`/plugin
API in `src/lib` (grep); integration points are hard-coded (`pkgs`/kinds in `scaffold.ts`,
pipeline order in `phases.ts`). Third parties cannot extend the pipeline without forking");
`90:334` (§7 item 5 — DSH's plugin ecosystem as a field gravity that RapidTool should
interoperate with, not out-community).

**CURRENT anchors (verified today, outputs in §7).**
- `grep -rn "plugin"` over `src/lib/*.ts`, `src/components/*.tsx`, `scripts/rapidtool-cli.mjs`
  → **exactly two** non-test hits, neither a registry: `scaffold.ts:1783` (emitted
  `vite.config.ts` text `plugins: [react()]`) and `engine.ts:3727` (a comment about TanStack's
  import-protection plugin) (cmd 40). Zero plugin/hook API, confirming A16.
- Hard-coded extension points (as A16 says): `scaffold.ts:76` `ProjectKind = "webapp" |
  "cli-tool" | "library" | "game" | "service"` (cmd 41); `phases.ts:3` `PHASES` array (13 fixed
  phases, cmd 42).
- The governance seam a registry must respect EXISTS: `src/lib/policy.ts` (245 lines) — "the
  ONE approval seam", pure leaf, no fs/clock/env, DEFAULT-DENY, every DENY carries a fallback
  (cmd 43). CLI verbs that write via a seat already call it (e.g. `edit`,
  `rapidtool-cli.mjs:1215-1220`, cmd 16).
- The "explicit selection only, never a default" doctrine has a landed precedent: the mock
  provider (`src/lib/llm/providers/mock.ts`, 189 lines; honesty rules at `:12-17`;
  never registered in `PROVIDERS`, never satisfies a configured probe — cmd 33). A plugin
  loader should copy this doctrine.

**What exists today.** Nothing user-facing. Extension happens by editing
`scaffold.ts`/`phases.ts`/`engine.ts` (fork).

**Exactly what is missing.** A registry module (`src/lib/plugin.ts` per 103:184) with: explicit
registration (never auto-load), a declared capability/hook vocabulary (e.g. post-phase action,
artifact renderer, prompt-section contributor — vocabulary is a design choice), deterministic
ordering, and a trust rule. Because plugins execute code in-process, the trust question is
entangled with the isolation decision (§4): **do not ship a mechanism that loads arbitrary
third-party code paths while the runner is explicitly not a sandbox.** v1 should be in-process,
statically-imported hooks only; dynamic path loading = UNKNOWN — needs the isolation decision
first.

**Done-when (proposed).**
1. A plugin registers a hook via an explicit call; an unregistered hook is provably never
   invoked (test).
2. Hook execution order is deterministic and documented.
3. Any hook that can write project state routes through `evaluatePolicy` (or is denied by
   default — deny-by-default per policy.ts doctrine).
4. Docs: what a plugin may/may not do; no "sandboxed plugin" language anywhere (P0-04 /
   §4).
5. Tests in the pattern of the repo's pure-module suites; CLI surface only if needed.

**Files a lane would own.** New `src/lib/plugin.ts` (+ test), seam call-sites in
`src/lib/engine.ts`, `src/lib/codegen.server.ts`, docs; CLI only if a verb is required.

**Honest size.** M (103:184).

**Blast radius.** High-trust surface: hooks run with the app's privileges. Keep the surface
in-process and explicit; never let a plugin auto-activate from an env var or a directory scan
(that is exactly the failure mode the mock-provider doctrine forbids).

### T5.7 — Deterministic LLM cassette / replay

**Dossier anchors.** `104:615`; `103:176` (A8, size **S/M** — "No cassette/replay anywhere
(grep 'replay|cassette|recorded' → prose only; the only 'cache' is a comment at
`codegen.server.ts:190`). Keyed runs are inherently irreproducible; the eval harness re-calls
the API each time. Where: `deepseek.server.ts` (record/replay mode keyed by prompt hash),
callers in codegen/verify/crew/chat/prompt-engine, `scripts/run-eval.mjs`");
`104:487` (A8 row in §4.5); `105_plan_critique.md:55` (C6: A14/T3.2's determinism expectation
depends on A8 — "either land a minimal record/replay seam with T3.2 or downgrade T3.2's
determinism expectation explicitly" — A8 is T5.7, two phases later; the critique stands).

**CURRENT anchors (verified today, outputs in §7).**
- `grep -rni "cassette" src/ scripts/` → **zero hits**; all "replay" hits are prose comments
  about chat/replay laws (e.g. `types.ts:399-400`, `chat.server.ts:26`), not a mechanism
  (cmd 26). A8 confirmed open.
- The single model-call chokepoint exists: `src/lib/llm/providers/registry.ts:396`
  `export async function callModel(...)` (cmd 44) — the natural cassette seam.
- The deterministic-INJECTION half already landed: `src/lib/llm/providers/mock.ts` — canned
  envelope queue, zero network, explicit-selection-only; its header (`:5-9`) says "a mock LLM
  *is* a replay fixture → 103 A8", and the mock-LLM E2E family is already in CI (T-107.10 per
  `fixes/216t`). What the mock does NOT do: record a real call and replay it byte-identically
  keyed by the real prompt.
- The reproducibility cost is real where it matters: `run-eval.mjs:13-19` — a keyed eval run is
  a bounded live entry; re-running re-calls the API (103 A8's point).
- Competitor precedent (verified in the clone today): opencode ships
  `packages/http-recorder` — package.json description: "Record and replay Effect HTTP client
  traffic with deterministic cassettes" (cmd 45).

**What exists today.** Deterministic fake (mock) + deterministic keyless floors. No record, no
prompt-hash-keyed replay, no tape file format.

**Exactly what is missing.** (1) Record mode: capture prompt + response envelope + served model
+ usage at the `callModel` seam into a tape keyed by prompt hash (one file or dir per run).
(2) Replay mode: serve byte-identical envelopes; a MISS is a coded refusal from
`src/lib/errors.ts` (existing code or a new registry entry — never a fabricated response).
(3) Explicit opt-in only (env/flag), never a default; a replayed run must be labeled — this
couples to T5.4: an artifact produced from a replayed envelope must say so in provenance
(honesty: a cassette replay is not a "real run" claim). (4) Eval integration:
`run-eval.mjs` `--record` / `--replay` so keyed eval history becomes reproducible.
(5) Doc note in README-cli/README.

**Done-when (proposed).**
1. Recorded tape from one keyed eval entry; a second run in replay mode over the same corpus
   yields identical maker scores WITHOUT network (assert no socket / keyless host still passes).
2. Tape miss → coded refusal, exit taxonomy respected, never fabricated text.
3. Off by default: all existing suites and `npm run eval` keyless behavior byte-identical.
4. Tests: unit (record→replay round-trip; hash key stability; miss refusal) + one integration
   test in the mock-LLM style.

**Files a lane would own.** `src/lib/llm/providers/registry.ts` (seam) or a new
`src/lib/cassette.ts` + adapter seam; `scripts/run-eval.mjs`; CLI flags;
`scripts/rapidtool-cli.mjs` (only if a flag/verb is exposed); tests.

**Honest size.** S/M (103:176). The record/replay core is S; the honesty plumbing (labels,
provenance, refusal codes) is the M half.

**Blast radius.** The model boundary. Hard rules: never on by default; never let replay satisfy
a keyed-run/provenance claim silently (label it); tapes contain real prompts — treat as data
that may contain brief content (no secrets in prompts today beyond `.env` key, which is never
sent by RapidTool code; but write the tapes under a run dir, not into `src/`); do not reinterpret
`isConfigured` probes (mock doctrine `mock.ts:18-21`).

### DONE-today findings (proven by command; do not rebuild)

Not one full Phase-5 task is done (taskuniverselog §2.5 stands at 0/8), but three sub-components
exist and must not be rebuilt:

1. **Fixture draft/approve backend (T5.2 half).** DO NOT rebuild: the CLI `fixtures` verb
   (`rapidtool-cli.mjs:879`, cmd 11) + `brief-fixtures.ts` human-only `approveFixtureCases`
   doctrine (cmd 12). What remains is the UI + store actions.
2. **Eval driver + rubric + corpus + results (T5.3 half).** DO NOT rebuild:
   `npm run eval` (package.json:21), `scripts/run-eval.mjs` (cmd 31), `maker-score.ts` M1–M9
   (cmd 35), corpus/graders/results (cmds 27-28). What remains is the verb + envelope + docs.
3. **Deterministic injection half of A8 (T5.7 half).** DO NOT rebuild: the mock provider
   (cmd 33) is the replay-fixture for E2E; what remains is RECORD + prompt-hash-keyed replay of
   real calls.
4. Also relevant as landed seams (preconditions, not tasks): `policy.ts` one approval seam
   (cmd 43); `edit`/`repair` dry-run diff plumbing (cmd 15); `importTreeDir` hash re-import
   (cmd 18).

---

## §3 — Product-decision register (T5.6, T5.8 — USER-OWNED)

`remainingwaves.md:208-210` puts "**product decisions** T5.6/T5.8 (USER-owned)" in W12, and
`taskuniverselog.md:285-286` marks them "product decisions, not engineering tasks — move to the
decision register". **This section states the decisions; it does not take them and does not
implement them.** Each decision is written as: the question in one sentence, the options, what
each option costs, what each option breaks, and what the repo does TODAY if nothing is decided
(all "today" statements verified 2026-09-24, §7).

### DECISION D-1 (T5.6) — Multi-language output, or a declared TypeScript-only boundary?

**The question, in one sentence.** Does RapidTool keep generating TypeScript/Node projects only
and say so as an explicit product boundary, or does it expand the factory to emit other
languages (Python/Go/…)?

**What the repo does TODAY (verified).** It is TypeScript-only in behavior, but the boundary is
NOT stated anywhere I could find: `scaffold.ts:76` `ProjectKind = "webapp" | "cli-tool" |
"library" | "game" | "service"` — every kind emits a TS tree (`tsconfigJson` at
`scaffold.ts:562`; vite/React webapp text at `:1771`; `package.json` skeleton at `:536`);
`grep "multi-language|Python|tenant" README.md` → **zero hits** (cmd 50), so the README neither
promises nor disclaims other languages. `103:179` (A11, dossier-taken) adds: `check`/`treeRun`
are Node-only; a factory for arbitrary briefs needs Python/Go/etc., or must declare TS-only.

**Option A — declare the TS-only boundary.** Cost: **S** (a README/AGENT_GUIDE line stating the
boundary; optionally a `dod.ts` capability declaration line; a doc-contract test like
README-cli's so the claim can't drift). Breaks: nothing functionally — it gives up the
"any brief" market openly (a Python brief is out of scope, said plainly), and any future
language work becomes an explicit new decision rather than an implied gap.

**Option B — add a language registry (multi-language).** Cost: **L** (`103:179`: registry →
language registry in `scaffold.ts`; per-language synthesis prompts + validation in
`codegen.server.ts`; per-language compile in `compile-check.server.ts`; runners/toolchains per
language; docs). Breaks: the current verification assumptions (oracle/spec emission is
TS-shaped), the Node-only runner, and it multiplies the surface the isolation decision (§4)
covers — running novel toolchains on the host is a strictly larger execution surface. Needs
per-language toolchains present (install/network policy).

**If nothing is decided.** Behavior stays Option A in practice (TS-only), but silently — no
surface tells a brief author that other languages are out of scope, which is the exact
"implied capability" the declare-or-strike rule exists to prevent.

### DECISION D-2 (T5.8) — Local-first single-tenant, or server-side storage / multi-tenant?

**The question, in one sentence.** Does RapidTool stay local-first and single-tenant (browser
localStorage + JSON project files; auth stays latent), or does it activate server-side accounts
and storage so multiple users, hosted runs, and durable cross-device history become possible?

**What the repo does TODAY (verified).** Local-first. `better-auth` is a dependency
(`package.json:54`, `~1.6.30`) and the lib layer is fully built —
`src/lib/auth/` contains client.ts, email-password.ts, gate-identity.server.ts,
gate-identity.test.ts, gates.tsx, gate-session.server.ts, gate-session-marker.ts,
isolation.server.ts, middleware.ts, pglite-dialect.ts (cmd 48) — but **no auth UI exists**:
`grep "signIn|sign-in|login" src/routes/` → zero hits (cmd 49). `migrations/` contains only
`migrations/auth/0001_auth.sql`, run by `scripts/migrate.mjs` (package.json:12, part of
`npm run build` at :11) — deploy-time only; per AGENTS.md, PGLite is the local fallback when
`DATABASE_URL` is unset. `94:196-201` (§G7) records the recommended posture: "local-first
single-tenant now (auth stays latent, documented), accounts later", with acceptance "README
states the auth posture honestly; no dead auth artifacts presented as features" — **that
acceptance is not yet met** (README has zero tenant/auth-posture hits, cmd 50; `94`'s own
verdict is that auth is "latent infrastructure").

**Option A — confirm local-first single-tenant (document it).** Cost: **S–M** (README posture
paragraph + optionally a `doctor` line; keep auth latent; no routes). Breaks: nothing; it does
mean multi-user/team use and hosted runs are out of scope and must not be implied; sharing
happens via project JSON export/import, not accounts.

**Option B — activate server-side storage / multi-tenant.** Cost: **L** (`103:185` A17 — db.ts,
auth/*, migrations/, routes/, store.ts). Breaks: the anti-cloud positioning story of Axis 2
(90:201-210 — "the anti-cloud, anti-lock-in axis" is a marketed differentiator); raises
data-tenancy questions (per-user isolation of project data) with no verified isolation story on
the server side; requires a hosting/DB story that `94` §M6 says is still unpackaged; and it
would make `DATABASE_URL` a live dependency instead of a deploy-time migration input.

**If nothing is decided.** Behavior is Option A (local-first, auth latent) **and the docs are
silent**, which is the worst of the two: the latent auth infrastructure (10 modules + a
migration) reads as "accounts coming" while nothing states the intent. `94:201` says the
minimum acceptance either way is a README posture statement.

---

## §4 — The isolation-boundary decision input (108-T7 / T-107.8)

**Why this is in this document.** The lane brief: restate the decision, list what must become
true for each outcome, cite `108:639-656` + `sandbox-policy.ts`, and write it so W11-L2's
concurrent host probe (docker/bwrap availability) can be dropped in. **The probe outcome was
UNKNOWN as of this writing — I did not guess it. [SETTLED 2026-09-24: ABSENT — no docker/bwrap
on this host (exit 127); WSL has 0 installed distributions. The drop-in slot at the end of this
section now carries the settled result + its evidence line; both branches remain written below.]**

**The decision, restated (from `fixes/216x` §2.3 item 3, which I read today).** 108-T7 asks for
E2E verification of an emitted app against a running instance. The dossier is explicit that
RapidTool cannot adopt it under the existing runner without a decision: *"To adopt this
honestly, RapidTool must either add a real isolation boundary or state plainly in the UI/packet
that the verification ran un-isolated — it cannot describe a Playwright run inside the existing
runner as sandboxed"* (`108:650-653`, verified today — cmd 46; also `108:639-641` for the
Mechanism-8 shape, and `108:688` for the T-107.8 row). The two legal outcomes for the boundary
itself (not for 108-T7, which stays deferred regardless until T4.1 + T-18 land):

**Outcome 1 — add a real isolation boundary.**
What must become true: (a) docker or bwrap is provably available on this host — **SETTLED
2026-09-24: NOT available today** (no docker/bwrap, exit 127; WSL 0 distros — `fixes/217b` §2;
this clause can only flip if an isolator is later provisioned on the host); (b) `sandbox-policy.ts` gains a real isolator
path: today it is frozen to `sandbox: false, kind: "none", docker: false, bwrap: false` with
the note `RUNNER_IS_NOT_A_SANDBOX` ("RapidTool's node-runner is a bounded timeout + env
allowlist. It is NOT Docker, bwrap, or a security sandbox." — verified at `sandbox-policy.ts:13-22`,
`runnerIsolationClaim()` at `:33` always returns the frozen honest claim, cmd 47; re-exported
at `node-runner.server.ts:26`); (c) `node-runner.server.ts`'s executor is swapped to the
isolator with its own tests; (d) the doctor/`isolation.note` surface flips **only when the
claim is provably true** — the module's own doctrine: "no caller can mint `sandbox: true`
without an actual isolator" (`sandbox-policy.ts:5-7`); (e) `104:633-635` §6.1 item 2 says do
not soften that wording while landing other work — the flip is a claims change, not a comment
edit.
If Outcome 1 lands, 108-T7's driver+dev-server design gets a container/namespace to run in;
the dossier's "far larger execution surface" warning (`108:650`) still applies to what runs
INSIDE the boundary.

**Outcome 2 — advertise un-isolated runs plainly.**
What must become true: every surface that runs or narrates execution (UI run/verify panes,
CLI envelopes, Agent Packet) states that runs were executed un-isolated, in plain language —
never "sandboxed". The frozen claim stays frozen; `runnerIsSandbox: false` stays false;
`remainingwaves.md:218-219`'s standing rule holds ("Never claim sandbox/Docker/bwrap isolation
… `sandbox-policy.ts` claims flip only when provably true (T-107.8)"). If 108-T7 is ever
pursued under this outcome, the label must cover a browser driver + dev server as well, because
those are a bigger surface than today's bounded child process (`108:650-653`).

**What is NOT legal under either outcome.** (a) Describing a Playwright run inside the existing
runner as sandboxed (`108:650-653`, `104` §6.1 item 2, `remainingwaves.md:218-219`).
(b) Flipping `sandbox-policy.ts`'s claim before a real isolator exists — the module is built so
that cannot happen by accident; do not weaken it. (c) Starting 108-T7 work before T4.1 + T-18
land — `fixes/216x` §2.3 item 3 gates it explicitly; the honest ceiling until then is "builds
and tests" (T-18), never "E2E".

**Drop-in slot for W11-L2's result — FILLED (settled).** `[W11-L2 PROBE RESULT — SETTLED
2026-09-24: ABSENT. No isolator on this host: docker/bwrap not found (exit 127); WSL is enabled
but has 0 installed distributions ("Windows Subsystem for Linux has no installed
distributions."). Evidence: fixes/217b_watchdog_verification.md §2 (:148–160) — the raw capture
(w11l2_scratch/isolation_probe.txt, 2026-09-24 10:27:17); re-run 2026-09-24 by W14-L2 (the
fill-in) with the same result — which docker bwrap → none; docker --version / bwrap --version →
exit 127; wsl.exe -l -v → no installed distributions. → Outcome 2 is the only available branch;
record it as the decision input and keep the claim frozen. Outcome 1 stays *possible* only if an
isolator is later provably available, and still requires the (a)–(e) chain above before any
claim changes.]`

---

## §5 — Competitor-gap refresh (honest table)

**Rules for reading this.** `verified today` = produced by a command in §7 run 2026-09-24.
`dossier-taken (cite)` = I did NOT re-verify it today; it comes from the named dossier line.
No marketing language on either side; "OPEN" is a to-do, not an insult. Competitor repos are the
read-only clones at `C:\Users\mnril\rt-competitors` (17 dirs, listing verified today).

### Table A — the Phase-5 capability axes (what each T5.x task closes)

| Axis (task) | RapidTool TODAY | Leading open-source tool | Verdict |
|---|---|---|---|
| Streaming output (T5.1) | One-shot POST (`chat.ts:19`); `stream: false` (`llm/providers/deepseek.ts:377`); zero SSE in `src/` — verified today | **bolt.diy** streams via the `ai` SDK `streamText` (`bolt.diy/app/lib/.server/llm/stream-text.ts:1,54,310` — verified today); Codex `codex.sse_event` / Gemini `--output-format stream-json` — dossier-taken (90:166) | **OPEN (parity)** — T5.1 closes it |
| Review surface for diffs / fixture cases (T5.2) | CLI-only: `fixtures --draft/--approve` (`rapidtool-cli.mjs:879`), dry-run `edit` diffs (`:1118`); ZERO fixture references in `console.tsx` — verified today | **bolt.diy** ships a real workbench incl. `DiffView.tsx`, `EditorPanel.tsx`, `FileTree.tsx`, `Preview.tsx`, `Inspector.tsx` (`bolt.diy/app/components/workbench/` — verified today; 108:282-285 describes its Q8 surface, dossier-taken); **Dyad** ships the human-approved assertion-card recorder (`Dyad/src/lib/test_recorder/assertion_proposal.ts`, `src/prompts/test_assertions_prompt.ts` — verified today; approval-before-spec order per 108:639-644, dossier-taken) | **OPEN** — T5.2 closes it (half A fixtures, half B diffs) |
| Maker-score / eval surface (T5.3) | Driver + M1–M9 rubric + 6-fixture corpus + persisted results exist; NO CLI verb (35 verbs counted); rubric reachable only from `run-eval.mjs:60` — verified today | App-generator field largely weaker: bolt.diy "Tests — none generated … the preview renders" (108:268-270, dossier-taken); gpt-engineer/GPT-pilot/ChatDev similar per 108 Q5 rows (dossier-taken) | **Mostly CLOSED vs the field; OPEN vs our own bar** (agent reachability) — S to close |
| Artifact provenance (T5.4) | `Artifact = {id, phase, kind, title, body, language?}` — no provenance (`types.ts:41-47`); chat-only provenance (`types.ts:451`); route vocabulary exists (`types.ts:21`) — verified today | No equivalent verified in the app-generator clones today; 90/42 characterize competitor trails as prose commits / informal (90:191, 90:225 — dossier-taken) | **OPEN — own-axis completeness** (Axis 4); T5.4 (S) closes it |
| Plugin / hook extension (T5.5) | Zero: 2 grep hits, neither a registry (`scaffold.ts:1783` emitted vite text; `engine.ts:3727` comment) — verified today | **opencode** ships `packages/plugin` (dir verified today); DSH plugin ecosystem — dossier-taken (90:334; community-flagged there) | **OPEN** — and a trust/product decision (§4) |
| Deterministic LLM cassette / replay (T5.7) | Zero cassettes; deterministic INJECTION only (`mock.ts`: canned-envelope queue) — verified today | **opencode** `packages/http-recorder`: "Record and replay Effect HTTP client traffic with deterministic cassettes" (package.json description — verified today; that is its own HTTP layer, not an LLM cassette for app runs) | **OPEN** (S/M) — T5.7 closes it |

### Table B — the five 90 §4 leapfrog axes (is the moat still real?)

| Axis (90 §4) | RapidTool TODAY | Field state | Verdict |
|---|---|---|---|
| 1. Governed honesty as protocol | `policy.ts` ONE seat seam, deny-by-default, pure (245 lines — verified today); CLI `edit` consults it (`rapidtool-cli.mjs:1215-1220`); `forceHuman` guard (`engine.ts:1646`); FNV-1a gate evidence hash (`dod.ts:675`); honest chat envelope (`chat.server.ts:40`) — all verified today | No verified equivalent; Codex `auto_review` substitutes model judgment; Antigravity "Always Proceed" unbounded — dossier-taken (90:191 via 42 §3.2) | **CLOSED in our favor**; Phase-5 ties: T5.4/T5.7 must keep labels true as new surfaces land |
| 2. Deterministic keyless floor | Keyless full-pipeline default (`run-eval.mjs:6-8`, read today); mock never "configured" (`mock.ts:18-21`); deterministic artifact factory (`engine.ts:252`) — verified today | "Every competitor dies without a model and an account" — dossier-taken (90:203) | **CLOSED in our favor** |
| 3. Bounded autonomy with hard HITL | One-action wild step + append-only events (`wildLog` `engine.ts:3343/:3547/:3617`); `forceHuman` gates can't be self-approved (`engine.ts:1646`) — verified today | Unbounded-by-design options elsewhere (Devin fleets; `approval_policy: never`) — dossier-taken (90:214) | **CLOSED in our favor** |
| 4. Paper trail as the product | Append-only wild events + packet/vault renderers exist (verified today); artifact-level provenance MISSING (T5.4) | GitHub's Copilot cloud marketing now sells this category ("every step in a commit") — dossier-taken (90:225) | **CLOSED on decisions; OPEN on artifact provenance** — T5.4 closes the gap |
| 5. One-key compounding self-learning | Lesson machinery present: `rankBriefLessons` (`knowledge.ts:90`), `lessonLinesForBrief` (:128), `selectLessons` (:1007), `shouldPromoteLesson` (:1035); eval priors `history.json` exists — verified today | Devin "reads past session trajectories" (prose) — dossier-taken (90:237) | **SUBSTRATE verified; end-to-end loop closure NOT verified today — UNKNOWN — needs a fresh loop verification** (write-back edges per 90 §5/93; later learning fixes landed per taskuniverselog §2.4, not re-checked here) |

---

## §6 — Priority ranking (distance closed on the maker test)

**The bar being ranked against:** `RESUME.md:57-60` — the Coffeehouse2Home / Property Ledger
suite for the owner's friend is the 10/10 maker test; judge priority by that, not test counts.
**Dominant caveat, stated first for honesty:** the P0-04 core failure (all five emitted jobs
re-export one file; `doctor --tree` `{reexports:5, real:0}` — `RESUME.md:62-73`) is NOT a
Phase-5 task and outranks everything below; it is owned by other lanes/tasks. Within Phase 5,
ranked:

1. **T5.3 — `eval` verb (S).** The corpus IS the maker-test fixture family
   (`coffeehouse2home-property-ledger.md` + five siblings); this is the cheapest step that puts
   the M1–M9 score in a driving agent's hands and unblocks scored iteration on the friend's
   suite. No dependencies.
2. **T5.2 half A — fixtures review UI (M; full task L).** Human fixture approval is what makes
   a "functional" claim honest, and today a non-CLI operator cannot perform it. Reuses landed
   helpers (`approveFixtureCases`); depends on nothing new to start.
3. **T5.4 — artifact provenance (S).** Cheap; completes the audit axis the product sells, and
   it is the honesty precondition for T5.7's replay labels (a replayed run must not read like a
   real one).
4. **T5.7 — cassette record/replay (S/M).** Makes keyed eval history reproducible — the
   precondition for "prove the loop" experiments on the suite. Sequence after (or with) T5.4.
5. **T5.1 — streaming (M).** Chat parity for the operator's daily pane; does not move the
   emitted app. Requires the transport spike first (UNKNOWN).
6. **T5.5 — plugins (M).** Breadth only; least maker-test distance; entangled with the §4
   trust decision — sequence after the isolation outcome is recorded.
7. **Decisions D-1/D-2 (§3)** — owner-gated documentation decisions; both ride W12 per
   `remainingwaves.md:208-210`. The isolation §4 outcome gates only future 108-T7/E2E work.

---

## §7 — Self-check and commands-run ledger

**Self-check (lane item 7).**
- Every `file:line` in this document was produced by a command below, run 2026-09-24 in
  `C:\Users\mnril\Desktop\RapidTool Main` (or is explicitly marked dossier-taken / UNKNOWN).
- Every count stated came from a command output: 35 verbs (cmd 7) · 28 `art(` sites (cmd 19) ·
  767 lines brief-fixtures (cmd 12) · 6050 lines console.tsx (cmd 14) · 245 lines policy.ts
  (cmd 43) · 39 lines deepseek.server.ts (cmd 8) · 189 lines mock.ts (cmd 33) · 6 corpus
  fixtures + 6 graders (cmd 27) · 10 console tabs (cmd 22) · 10 auth modules (cmd 48) ·
  13 phase codes P0–P12 (cmd 42) · 2 plugin grep hits (cmd 40) · 17 competitor clone dirs
  (cmd 45).
- Nothing was run that the lane forbade: no `npm test` / `npm run build` / `npm run typecheck`;
  no git mutations; no `src/`/`scripts/` writes. Only this file was written.

**Commands-run ledger** (cmd → what ran → observed result):

| # | Command (short form) | Observed |
|---|---|---|
| 1 | `read_file wave_plans/W11/lane-3.md` | 92 lines — the plan, read in full |
| 2 | `ls wave_plans/W11/` · `ls fixes/ \| head -50` | lane-1..6 + README; fixes 216*/217* present |
| 3 | section-heading greps: RESUME / remainingwaves / taskuniverselog | §11 :633 · W11 :200, W12 :206 · §2.5 :276 |
| 4 | `grep -n "T5\." research/multiagent/104…md` | :612-616 = Phase 5 row incl. quoted T5 lines |
| 5 | section maps: `grep "^#\{1,3\} " 104` · `grep "^#\{1,4\} " fixes/216x` | 104 §5 :530 / Phase5 :610; 216x §2 :89, §2.2 :134, §2.3 :163 |
| 6 | `grep -rn "text/event-stream\|EventSource" src/ scripts/` | 1 hit: `src/lib/sandbox.ts:316` (stub string, not SSE) |
| 7 | `grep -c 'case "' scripts/rapidtool-cli.mjs` · `grep -rn "rubric" src/lib/*.ts scripts/*.mjs` | **35** verbs · maker-score.ts:2, run-eval.mjs:10 |
| 8 | `wc -l src/lib/deepseek.server.ts` + head | **39** lines — thin re-export (T-107.2) |
| 9 | `grep -in "stream" src/lib/llm/providers/deepseek.ts` | `:377 stream: false` |
| 10 | `grep -n "CHAT_CONTEXT_MAX_CHARS" src/lib/chat.server.ts` | `:53` = **3200** |
| 11 | `sed -n '879,941p' scripts/rapidtool-cli.mjs` | `fixtures` verb: draft / approve --ids / --approve-all, "never auto" |
| 12 | `head -30 src/lib/brief-fixtures.ts` + `wc -l` | human-DRAFTS/machine-never-approves doctrine; **767** lines |
| 13 | `grep -in "fixture" src/components/console.tsx` | **zero hits** |
| 14 | `wc -l src/components/console.tsx` | **6050** |
| 15 | `grep -n 'case "' scripts/rapidtool-cli.mjs` (full) | 35 cases; `edit` :1118, `repair` :1013, `tree-run` :942 |
| 16 | `grep -n "eval" scripts/rapidtool-cli.mjs` | only `evaluatePolicy` (:556, :1215-1220); **no eval verb** |
| 17 | `ls research/multiagent/` (all) · `ls fixes/ \| grep 216` | 100+ dossiers incl. 90/93/94/103-108; 216a–216y |
| 18 | `grep -rn "importTreeDir" src/lib/headless.ts` | def `:2099`; callers `:2486`, `:2639` |
| 19 | `sed -n '245,270p' src/lib/engine.ts` · `grep -o "art(" \| wc -l` | `art()` `:252`; **28** call sites |
| 20 | read `src/lib/chat.ts:12-43` | `:19` createServerFn POST; `:28` chatOnceServer; `:37` chatContextServer |
| 21 | `grep -n "async function send" console.tsx` · `sed -n '5245,5275p'` | send `:5333`; one-shot liveness comment `:5254-5255` |
| 22 | `grep -n 'id: "' console.tsx \| head -25` | **10** tab ids at `:135-144` |
| 23 | `grep -n "acceptanceFixtures\|Fixture" src/lib/store.ts` | empty — no fixture actions |
| 24 | `grep -n "fixture" src/lib/headless.ts` | `:39`, `:1928-1954` (P6 journey), `:3194` (seat refusal text) |
| 25 | `grep -n "not-configured" src/lib/chat.server.ts` | `:40` (+ doc lines) |
| 26 | `grep -rni "cassette\|replay" src/lib/*.ts scripts/rapidtool-cli.mjs` | **zero cassette**; replay = prose comments (types.ts:399-400 etc.) |
| 27 | `ls research/eval-corpus/` + `graders/` | **6** fixtures + README + **6** grader JSONs |
| 28 | `ls research/eval-out/*.json` | `results.json`, `history.json` |
| 29 | `ls src/components/*.test.*` · `grep -n '"test"' package.json` | none (exit 2); test globs = src/lib only (`:19`) |
| 30 | `grep -n "@tanstack/react-start" package.json` | `:51 ^1.168.0` |
| 31 | `head -55 scripts/run-eval.mjs` | keyless default; grader leak-scan; trials/pass@k; "exits 0 always" |
| 32 | `grep -n '"eval"' package.json` | `:21` npm script |
| 33 | read `src/lib/llm/providers/mock.ts` | **189** lines; explicit-selection-only; never configured |
| 34 | `head -30 scripts/README-cli.test.mjs` | doc-contract binds verb count + list |
| 35 | `grep -rn "maker-score" src/lib/*.ts scripts/*.mjs` | consumers: `run-eval.mjs:60` only; headless/doctor grep "maker" = 0 |
| 36 | types.ts reads | `Artifact :41-47`; `ModelRoute :21`; provenance `:103, :187, :451` |
| 37 | `grep -rn "Artifact\b" src/lib/codegen.server.ts` | `:2128`, `:2181`, `:2948` |
| 38 | `grep -n "artifacts" src/lib/io.ts` · engine wellFormed | io `:324, :372-373`; `wellFormedArtifactRow :1992/:2183` |
| 39 | packet/vault artifact renderers | `packet.ts:302, :506`; `vault.ts:336-338` |
| 40 | `grep -rn "plugin" …src/lib, components, cli` | **2** hits: `scaffold.ts:1783`, `engine.ts:3727` |
| 41 | `grep -n "Kind\|kinds" src/lib/scaffold.ts` | `ProjectKind :76`, `KIND_ORDER :96`; `tsconfigJson :562` |
| 42 | `sed -n '1,30p' src/lib/phases.ts` · `grep -c 'code: "P'` | `PHASES :3`; **13** codes P0–P12 |
| 43 | `head -40 src/lib/policy.ts` + `wc -l` | ONE approval seam; **245** lines; deny-by-default |
| 44 | `grep registry callModel` · `grep knowledge.ts exports` | `registry.ts:396`; knowledge `:90/:128/:1007/:1035` |
| 45 | competitor greps/ls (read-only clones) | bolt.diy `stream-text.ts:1,54,310` + workbench `DiffView.tsx` etc.; Dyad `tests_handlers.ts:266` + assertion files; opencode `packages/plugin` + http-recorder desc; aider `commands.py:553 cmd_undo`; **17** clone dirs |
| 46 | dossier reads: 108:630-690 · 216x §2.2/§2.3 · 90 §2/:131-256/§4/§6-7 · 94 §G2-G7:163-201 · 106 §6 · 93 greps | quotes per §1–§4 above |
| 47 | `sed -n '1,35p' src/lib/sandbox-policy.ts` + claim greps | claim `:13-22`; `runnerIsolationClaim() :33`; `node-runner.server.ts:26` |
| 48 | `grep -n "better-auth" package.json` · `ls src/lib/auth/` | `:54`; **10** modules |
| 49 | `grep -rn "signIn\|login" src/routes/` | **zero hits** — no auth UI |
| 50 | `grep -n "multi-language\|tenant\|Python" README.md` | **zero hits** |
| 51 | `grep -n "wildLog\|forceHuman" src/lib/engine.ts` · `grep -n "fnv1a\|FNV" src/lib/dod.ts` | wildLog `:3343/:3547/:3617`; forceHuman `:1646`; `dod.ts:675` |
| 52 | `grep -n "db:migrate" package.json` · `find migrations -type f` | `:12` (+`:11` build); `migrations/auth/0001_auth.sql` only |
| 53 | `grep -n "fixture\|Fixture" src/lib/engine.ts \| head -30` | `:2332-2351` (coerce/stale), `:2410-2411`, `:2416-2424` (stale reversion row) |
| 54 | `grep -n "artifacts" src/lib/engine.ts \| head -30` | `:357-358`, `:1399-1402` (last-artifact replace), `:1426-1428`, `:2179-2183` |
| 55 | dossier/board reads (read_file ranges + greps) | RESUME §1.0 `:36-130` + §11 `:633-692`; remainingwaves `:195-231`; taskuniverselog `:276-305`; 104 `:421-465`, `:560-639`; 90 `:131-255`, `:274-331`; 94 `:155-206`; 106 `:435-475`; 108 `:45-74`, `:255-285`, `:630-690`; 103 §3 rows `:169-186`; 105 `:55,:117`; 93 `:11,:33,:162`; 107 follow-ups `:333-335`; 216x `:89-224` |

**End of document — W11 · LANE 3 deliverable.** Status: COMPLETE; docs-only; nothing modified
except this file.
