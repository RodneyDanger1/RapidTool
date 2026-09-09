# fixes/64 — Pillars 3+6: handoff export profiles + hyper-prompt engine

**Agent:** Flash Pillar B3 (handoff profiles + hyper-prompt engine) — wave integration.
**Status:** LANDED — suites green individually; repo mega-gate results at the bottom.

## What landed

### NEW `src/lib/prompt-engine.ts` (hyper-prompt expansion + policy constraints)

- `ExpandedSpec` — the exhaustive expansion shape: `{requirements, edgeCases,
  errorHandling, typeSignatures, dataFlow, negativeConstraints}` (all
  `string[]`).
- `expandBrief(brief, policies?)` → `ExpandBriefResult` — ONE DeepSeek flash
  call via `completeDeepSeek` with `json:true`, `model: DEEPSEEK_MODELS.flash`
  (pinned `deepseek-v4-flash` on the wire), `maxTokens: 3000`, system prompt
  framing the hyper-prompt-engine role. Optional policies are fed into the
  user message ("Policy constraints …") so the model designs around them.
  Honesty ladder: key absent → `{ok:false, reason:"not-configured"}` BEFORE
  any network I/O; blank brief → validation error pre-network; unparseable /
  requirement-less model JSON → `{ok:false, reason:"error"}` — never a
  fabricated or substituted spec. Prompt-budget caps exported:
  `EXPAND_BRIEF_MAX_CHARS` (4000), `EXPAND_POLICY_MAX_CHARS` (240),
  `EXPAND_POLICY_MAX_COUNT` (12).
- `applyPolicies(spec, policies?)` — PURE negative-constraint injection:
  returns a NEW spec (fresh object + fresh arrays — caller mutation never
  leaks into the input); `negativeConstraints` = model-derived entries first,
  then each policy not already present (exact match on trimmed form,
  case-sensitive, caller order preserved). Deterministic.
- `parseExpandedSpecJson(text)` — public tolerant parser/normalizer (fence-
  tolerant, fixed six-key shape, missing keys → `[]`, trim + dedupe-first-wins
  via `cleanList`); null when not JSON/not an object/no usable requirements.
- Server-only at runtime (static `./deepseek.server.ts` import, planning.ts
  pattern — client modules may type-import only). No dates/randomness/state.

### `src/lib/packet.ts` — additive `exportProfiles` (compileAgentPacket untouched)

- `exportProfiles: Record<"claude-code"|"cursor"|"cline"|"aider"|"devin"|"copilot", {name, wrap(packet, project)}>`.
  Pure, byte-deterministic per input pair. Each wrap: tool heading with
  project name → session framing naming the current edge (PHASES lookup with
  the same P0 fallback as compileAgentPacket) → tool mechanics bullets →
  file-scope section → packet VERBATIM (`## Packet (verbatim — governs)`) →
  one-JSON required-report footer.
  - claude-code: step-plan-first CLI discipline + `claude -p` headless hint.
  - cursor: Composer paste + `@-reference` directives incl. conditional @AGENTS.md.
  - cline: task-prompt paste + `.clinerules/`/CLAUDE.md custom-instructions conditional.
  - aider: file-diff scoping — `aider --read rapidtool-packet.md <spec-graph files in graph order>` as the EDIT set, minimal-unit-diff rule.
  - devin: session-ticket framing, pause-for-human at HITL gates.
  - copilot: Copilot Chat/Edit framing + `.github/copilot-instructions.md` conditional + @workspace.
- Honesty: nothing claims files exist on the operator machine (all repo-file
  mentions conditional); no spec graph → explicit fallback sentence; empty
  packet → `(empty packet — run compileAgentPacket(project) first, then wrap again)`.
- No renamed/removed exports, `PACKET_VERSION` stays 3, `systemJson`/
  `compileAgentPacket` byte-identical (existing pins untouched).

## Tests

- NEW `src/lib/prompt-engine.test.ts` — 16 tests: parseExpandedSpecJson
  (fence tolerance, deterministic normalization, null cases), expandBrief
  (keyless no-fetch not-configured, blank-brief pre-network error, success +
  wire pin `deepseek-v4-flash`/`response_format json_object`/thinking disabled/
  maxTokens, policies reach the prompt, unparseable + requirements-less honest
  errors, HTTP-400 non-retryable rejection propagation), applyPolicies
  (append order, dedupe semantics, purity/fresh-copy, determinism,
  non-string/blank filtering, other-fields passthrough). Recipe: env-key
  delete/restore + fetch stub (algo-tools.test.ts pattern; safe per file — node
  --test child-process isolation).
- `src/lib/packet.test.ts` — 8 new tests (total 40): fixed key order + names
  pin, packet-verbatim embed + byte-determinism per profile, claude-code
  step-plan/edge anchors (+ no cursor-ism leak), cursor @-reference anchors,
  aider scope command/order + honest no-specGraph fallback, cline/devin/
  copilot framing anchors, pairwise distinctness across all six, purity +
  input sensitivity, empty-packet marker.

## Gate results (run 2026-09-06, during the wave — siblings mid-edit)

- `node --experimental-strip-types --test src/lib/prompt-engine.test.ts` — 16/16 pass.
- `node --experimental-strip-types --test src/lib/packet.test.ts` — 40/40 pass (32 pre-existing + 8 new).
- Pair run (auto-discovery shape): prompt-engine + packet — 56/56 pass.
- Full lib glob (`src/lib/*.test.ts` + app-data + auth): 846 tests, 841 pass,
  5 fail — ALL 5 in sibling wave-63 lanes, none reference packet/prompt-engine:
  ast-mine.test.ts "conventionsMap + respectConventions" (3 nested),
  crew.test.ts:280 "swarm layer — crew protocol conformance (fixes/63_pillars_swarm.md)"
  (3 nested), knowledge.test.ts "KnowledgeStore — ranking + injection"
  (injectProven). ast-mine.ts/swarm-knowledge files appeared on disk at
  08:03–08:06 (mtime) — mid-wave landings by sibling pillars; do NOT chase.
- `npm run typecheck`: my lane 0 errors under the project config; 2 remaining
  errors belong to sibling in-flight files (knowledge.test.ts:129
  `NewKnowledgeEntry` tags shape, swarm.test.ts:350 Project phases shape) —
  attribute by file/mtime (knowledge.test.ts 08:06, swarm.test.ts 08:03), not mine.
- `npx eslint` on the four touched files — 0 issues.
- `npm run build` — exit 0 (nitro build ok; db:migrate skips, DATABASE_URL unset — normal).

## Integration notes (for consumers / later waves)

- `expandBrief` returns the spec; compose with `applyPolicies(spec, policies)`
  for guaranteed negative-constraint enforcement, then feed requirements/
  dataFlow into a follow-up `compileAgentPacket`-adjacent hyper-prompt section
  (NOT in this wave — packet format unchanged).
- `exportProfiles[id].wrap(compileAgentPacket(project), project)` is the
  intended one-liner for CLI/headless export (`export --profile <id>` etc. —
  no CLI verb landed here).
- Pitfall hit during build: a backtick INSIDE a template literal terminates
  it — the `claude -p` hint needs `\`` escapes (fixed + suite-verified).
  Second pitfall: TS narrows a closure-assigned `let x: T | null = null` to
  `never` past an await — capture through a pre-initialized container object
  (`const captured: { body: RequestInit } = { body: {} }`), the algo-tools
  test recipe.
