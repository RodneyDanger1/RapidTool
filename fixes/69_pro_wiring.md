# 69 — PRO fixer A: Pillar-1 (harvest) rebuild + new-pillar CLI wiring

- **File:** `fixes/69_pro_wiring.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`; NOT a git repo)
- **Date / agent:** 2026-09-06 · PRO fixer A (re-dispatch of the cap-dead B1 pillar per `research/multiagent/29_live_guidance.md` open item #3, plus the new-pillar CLI wiring from `research/multiagent/26_debug_contract_gaps.md` §5)
- **Scope:** Pillar 1 harvest rebuild + headless/CLI wiring for ALL new pillar modules (harvest/swarm/prompt/bench/mine/knowledge/wild). Strict file ownership honored: only `src/lib/harvest.ts` (NEW), `src/lib/harvest.test.ts` (NEW), `src/lib/headless.ts` (additive exports only), `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, and this file were touched. `patch`-only on existing files; no renamed/removed exports; `.ts` extensions; one-JSON-envelope + exit-code discipline preserved.

## What landed

### 1. `src/lib/harvest.ts` (NEW — Pillar 1, per the B1 design contract)

- `buildHarvestQueries(brief, opts?)` → `HarvestQueryPlan {queries, source: "llm"|"keyword", note?}`.
  deepseek-v4-flash (`json:true`) ONLY when a key is configured AND the call
  succeeds; any other path (no key, LLM failure, unparseable payload, throw)
  falls back to the deterministic keyword floor and `source` honestly says
  `"keyword"` with a degradation `note`. Deterministic floor: same brief →
  identical queries (test-pinned).
- `harvestRepos(queries, opts?)` → `HarvestSearchResult {hits, notes}`.
  Keyless `freeWebSearch` → GitHub candidate URLs (chrome/non-GitHub URLs
  filtered) → bounded direct fetches: **≤4 fetch attempts** (raw.githubusercontent
  README head + GitHub-API license spot-check, one each per repo) within a
  **12 s wall-clock budget**. Per-hit `provenance` (`web-search` |
  `github-raw` | `github-api`); `license` present ONLY when the API actually
  returned one. Every failure/skip is surfaced in `notes`; total failure →
  honest empty `hits: []` — **nothing is ever fabricated**.
- `extractPatterns(text)` → `ExtractedPattern[]` (top-level column-0
  functions/exports/arrow-exports/interface|type/object-literal schemas with
  best-effort key collection). HONEST label: `EXTRACT_PATTERN_DISCLAIMER`
  ("pattern-level structural regex — NOT an AST parse"); every entry carries
  `confidence: "pattern"`. Indented (nested) functions are never claimed
  top-level.
- `trendNotes(brief, hits)` → deterministic deprecated-API advisory (7 marker
  regexes; disclaimer first; no-signal note when clean).
- `harvestForPacket(project, opts?)` → `HarvestPacketResult` — deduped research
  rows `{kind:"research", provenance:"harvest", repo, title, url, snippet,
  license?, hitProvenance}`; validation failure → `{ok:false,
  code:"RT_E_VALIDATION"}` for a missing brief.
- Test seams (`HarvestOptions`: search/fetchText/fetchJson/llm/llmConfigured +
  bounds) make the whole module hermetic-testable; defaults are the real
  bounded behavior. Backends used directly (`websearch.server.ts` /
  `deepseek.server.ts` — bare-Node proven), NOT `research.ts`'s
  `research()` (a TanStack server-fn that throws outside a Start runtime).

### 2. `src/lib/harvest.test.ts` (NEW — 33 tests, 33/33 green)

Covers: not-configured keyword floor + determinism, empty brief, LLM-path
success/dedupe + all three LLM degradation arms (failure/unparseable/throw)
with honest `source:"keyword"` flags, no-queries/skip, honest-empty on search
failure, happy path with provenance + license, raw-fetch-failure fallback,
license-API-failure absence, **fetch-count bound (exactly 2 attempts at
maxFetches 2)**, **time-budget bound (0 fetches after deadline)**, URL hygiene,
pattern extraction (incl. nested-function exclusion + schema keys), trend
notes, row dedupe + shape, RT_E_VALIDATION, plus smoke tests for all eight new
headless bridges.

### 3. `src/lib/headless.ts` (ADDITIVE only — appended at end, no existing line touched)

Eight new exports (thin wrappers, dynamic-import style identical to the
existing vault/crew/verify/design/diagram bridges):
`harvest(project, opts?)` → harvestForPacket; `swarmPlan(project)` →
swarm.ts; `promptExpand(project, policies?)` → prompt-engine.ts;
`benchProject(project)` → all four bench estimators + disclaimer;
`mineDir(dir, opts?)` → bounded deterministic walk (skip dirs, extension
filter, 200-file/2 MB/512 KB-file caps, every skip reported) +
mineCodebase/conventionsMap; `knowledgeSave(storePath, pattern)` /
`knowledgeFind(storePath, query, limit?)` → KnowledgeStore;
`wildStartHeadless(project, {maxSteps?})` → bounded engine.wildStep macro-run
(default 24, clamp 1–48), honest `not-wild`/`not-active` refusals, cap note
when still advancing at the limit. Verified: 0 pre-existing headless exports
renamed/removed; typecheck-clean.

### 4. `scripts/rapidtool-cli.mjs` (additive cases + USAGE + header)

Seven new subcommands, each one-JSON via the existing `respond()` choke point,
exit-code honest: `harvest` (0; honest-empty rows on outage; 1 bad project),
`swarm` (0/1), `prompt` (0; **3** not-configured → `RT_E_LLM_NOT_CONFIGURED`
pinned by respond; 4 backend), `bench` (0/1), `mine --dir [--limit]` (0;
1 + `RT_E_VALIDATION` on unreadable dir), `knowledge --store
(--save <json>|--find <query>) [--limit]` (0; 1 + `RT_E_VALIDATION` on
malformed JSON/shape or both/neither verb), `wild --project [--steps]` (0 and
persists the stepped project atomically; 1 + `RT_E_PHASE_ILLEGAL` on
not-wild/not-active, nothing persisted). No new RT_E_* codes added — the
existing registry is reused (documented in README).

### 5. `scripts/README-cli.md`

Subcommand count 17 → 24; new command-list entries + detailed sections
(Harvest/Swarm/Prompt/Bench/Mine/Knowledge/Wild) with real envelope examples;
error-code section notes the new commands reuse existing codes; agent loop
extended (steps 13–18); Tests section now includes harvest.test.ts.

## Verification (all run after the last edit)

- `npx tsc --noEmit` → **0** (baseline was already 0; a transient
  chat.server.ts:301 TS2322 observed mid-run was another wave agent's live
  edit — mtime 09:40 vs my 09:36 — and self-resolved; not mine, untouched).
- `node --experimental-strip-types --test src/lib/harvest.test.ts` → **33/33**.
- Live CLI smoke (real network, keyless): create 0 · swarm 0 (2 critiques,
  refinedPlan) · bench 0 (disclaimer + 4 estimators) · mine 0 (limit honored,
  skips reported) · knowledge save 0 (K1b801808, idempotent) · find 0 (score 1)
  · bad-save 1 `RT_E_VALIDATION` · wild 1 `RT_E_PHASE_ILLEGAL` (not-wild) ·
  prompt 3 `RT_E_LLM_NOT_CONFIGURED` (no key on host) · **harvest 0** — real
  hits: `clawnify/OpenFieldService` (MIT) and `akiscode/real_time_library`
  (Apache-2.0), provenance `github-raw`, keyword queries, honest budget note.

## Notes for the verifier / parent

- **Not in this lane (by strict ownership), left untouched:** `research.ts`
  (ledger row #5 said "research.ts additive seam" — the landed design imports
  research's *types* only and uses the bare-Node backends directly, so no
  research.ts edit was needed or made), `headless.test.ts` (the §5 checklist's
  "CLI taxonomy test per new case" — headless.test.ts is owned by the headless
  builder; the new bridge behavior is instead pinned inside harvest.test.ts's
  bridge describe block, 33 tests total), `errors.ts` (no new codes added by
  design), and the B6/B7 leftovers (store initializer + console.tsx were
  already green at my baseline: tsc 0 at 09:36).
- The 10 `scripts/*.test.mjs` env-baseline failures documented in the wave
  ledger remain out of scope (never chased).
- `mine`'s `skipped.overLimit` intentionally lists EVERY overflow file name
  (honest, never silent) — can be large on big trees; consumers should read
  `fileCount` first.
