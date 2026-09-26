# 262 · LANE 4 — OV-1 provider env/doctor surfacing + OV-41 spend telemetry (packet/doctor)

**Wave:** W23 · CODE-ALL · LANE 4 (`wave_plans/W23/code-all.md`). **RULE: code only — no test/typecheck/build/lint runs.** Verification is the parent boundary's.
**Box:** `src/lib/doctor.ts`, `src/lib/llm/providers/registry.ts`, `src/lib/packet.ts` (everything else read-only).
**Status:** DONE (code-only). All edits landed; free syntax sanity passed (see §Verification-that-was-allowed). Types/tests are the parent boundary's.

## Scope read-back

- **OV-1** (`220_tasklist_canonical.md:58`; playbook `230:730-752`; spec `101 §4.4`): provider env selection
  (`RAPIDTOOL_PROVIDER`) + doctor surfacing. Existing: doctor already carries the T-107.2 provider-team
  surface (`doctor.ts:327-420` — providers + per-role resolved models). Missing: `RAPIDTOOL_PROVIDER` exists
  only in comments (`registry.ts:36`, `mock.ts:31`) — **no parser** (`222_codebase_integration_map.md:68`).
  Done-when: unknown id → coded `RT_E_VALIDATION` refusal (never a silent deepseek fallback); default path
  byte-identical (unset ⇒ today's behavior); doctor prints provider/model honestly, keyless ⇒ not-configured.
- **OV-41** (`220_tasklist_canonical.md:177`; `227 §3 C1`; `fixes/228 §3 #14` ACCEPT): surface measured spend
  (tokens + `estimateCostUsd`) in the packet + doctor summaries, from T-107.6's ledger
  (`src/lib/token-ledger.ts` — landed surface: `totalTokens` :113, `estimateCostUsd` :241, cache fields
  :78-91, `TokenBudget` seam). Consume fields only — **never recompute, never fabricate**. Reader-side seams
  extended minimally where a field had no caller path yet.

## Evidence read this pass (disk)

- `registry.ts:35-40` — the deferred list naming `RAPIDTOOL_PROVIDER` (no parser on disk).
- `registry.ts:112-195` — `LlmProviderId` (deepseek | mock | xai), `PROVIDERS` (deepseek, xai-candidate),
  per-provider `requestModelIds`; `mock` is deliberately NOT in `PROVIDERS` (explicit-only).
- `registry.ts:225-266` — `resolveExplicitProvider` precedent: provider-scoped id validation, "first
  request id" as the no-model default, coded refusals, never a substitution.
- `openai-compatible.ts:114-185` — xai descriptor: candidate, `requestModelIds: []`, `verification.kind:
  "live-probe"`; a verified descriptor is minted only by `applyProbedModels` from probed ids.
- `doctor.ts:327-420` — T-107.2 provider-team surface (existing `line`, `tiers`, `providers`).
- `token-ledger.ts` (read-only) — `TokenSpend`/`TokenLedger` fields + `totalTokens` + `estimateCostUsd`
  (caller-supplied prices; **no price catalog ships** — 107 §11).
- `packet.ts:216-542` — `compileAgentPacket` is pure/client-safe; `opts.proven` is the existing optional-seam
  idiom (absent ⇒ byte-identical); envelope = `systemJson` (additive keys precedent: `phase_coverage` was
  added post-v3 by T-14 without a version bump; `packet.test.ts:98` pins `PACKET_VERSION === 3`, and that
  file is NOT my box — so the spend block is additive and the version stays 3).
- `types.ts:435-436` — `Project.tokenUsage?: { promptTokens; completionTokens }` ("B3: accumulated DeepSeek
  token usage for this run. Absence = unmetered.") — **declared but zero producers/consumers today**
  (repo-wide grep: only that line). This is the persisted ledger slice the packet consumes.
- `doctor.test.ts` (LANE 6's file, read-only): no exact-key/deepEqual on the whole claim — additive claim
  fields are safe; `packet.test.ts` uses `.includes`/sub-object deepEquals — additive envelope keys and an
  absent-by-default prose section are safe.
- `RAPIDTOOL_PRICE_<PREFIX>` = `101:683` ("only for cost ESTIMATES") — **not parsed anywhere on disk**
  (grep). Prices therefore stay caller-supplied at both new seams (no catalog invented here).

## Edits (each numbered hunk kept separable)

### 1. `src/lib/llm/providers/registry.ts` — OV-1 env selection (the parser that did not exist)

- **Header** (~:35-40): the "deliberately deferred" paragraph updated — multi-provider env selection LANDS
  here (W23-L4); failover, autodetect, probes stay deferred (step 2 = F2/probe).
- **NEW, after `getProvider()` (~:201):**
  - `PROVIDER_ENV_VAR = "RAPIDTOOL_PROVIDER"` — the one env name (101 §4.4).
  - `DEFAULT_PROVIDER_ID: LlmProviderId = "deepseek"` — precedence rung 4 (unset ⇒ today's behavior).
  - `EnvProviderSelection` + `resolveEnvProvider(env = process.env)` — pure resolver over `PROVIDERS`
    (the registry's own descriptor list):
    - unset/blank ⇒ `{ ok: true, provider: <deepseek descriptor>, requested: null, source: "default" }`;
    - registered id ⇒ `{ ok: true, provider, requested, source: "env" }`;
    - **unknown id ⇒ `{ ok: false, code: "RT_E_VALIDATION", error }`** naming the registered ids — never a
      silent default (`mock` is not in `PROVIDERS`, so it refuses too — explicit-only, unchanged).
  - `EnvSelectedRoute` + `resolveEnvSelectedRoute(role, opts)` — the ONE route resolution the doctor and
    `callModel` share (no duplicated branch logic): default/same-provider ⇒ the role-tier path
    (`resolveRoleModel`, byte-identical); env-selected OTHER provider ⇒ provider-SCOPED model resolution
    (explicit model → `<PREFIX>_MODEL_<ROLE>` pin → the descriptor's own first request id, the same rule
    `resolveExplicitProvider:265` already uses), all validated against THAT provider's `requestModelIds`
    — ids are provider-scoped; an empty namespace (today: the xai candidate) is a coded `RT_E_VALIDATION`
    refusal naming the candidate/probe status. Never a cross-namespace substitution.
- **`callModel` (~:441-477):** env selection wired as a gate + route, ONLY when `RAPIDTOOL_PROVIDER` is set
  and names a provider other than the role's tier provider. Unset ⇒ `source:"default"` ⇒ the existing path
  runs untouched (byte-identical). An unknown id refuses BEFORE any network I/O. The explicit
  `opts.provider` path (precedence rung 1) is untouched and runs first.

### 2. `src/lib/doctor.ts` — OV-1 surfacing + OV-41 doctor-side reader

- **Imports:** `estimateCostUsd`, `totalTokens` + `TokenLedger`/`TokenPrices`/`TokenSpend` types from
  `./token-ledger.ts` (client-safe — the module doc already declares this graph).
- **OV-1:** `DoctorProviderEnvSelection` type + `envSelection` field on `DoctorProviderTeam`;
  `doctorProviderTeam` builds it from `registry.resolveEnvProvider` / `registry.resolveEnvSelectedRoute`
  (reads the registry's own descriptors — no new source of truth, no key VALUE read: keyed =
  `Boolean(env[apiKeyEnv]?.trim())`, mirroring the existing `DoctorProviderEntry` probe). The line carries
  the honest wording: `cloud-by-default, keyless floor` when unset (RAPIDTOOL_PROVIDER unset ⇒ deepseek;
  no key ⇒ `RT_E_LLM_NOT_CONFIGURED` + deterministic scaffold — never fabricated model text); keyed
  truthfully when the selected provider's key is set; a refusal line for unknown ids (never "defaulted").
  The existing `line`/`label`/`providers`/`tiers` fields are untouched (byte-identical consumers).
- **OV-41:** `DoctorSpend` type + `doctorSpend(source, prices?)` reader — consumes ledger fields
  (prompt/completion/calls/cache) and the ledger's OWN helpers (`totalTokens`, `estimateCostUsd` with
  caller prices); no prices ⇒ `estimatedCostUsd: null` (never a made-up dollar figure); no ledger ⇒
  `measured: false` with all-null numbers (never a fabricated 0) + honest `line`. `DoctorFactory` gains
  `spend: DoctorSpend`; `factoryClaim(evidence, env, spend?)` + `doctorFactory(env, spend?)` accept an
  optional ledger (additive arity — existing 1/2-arg callers unchanged).

### 3. `src/lib/packet.ts` — OV-41 packet-side surfacing

- **Imports:** `estimateCostUsd`, `totalTokens` + types from `./token-ledger.ts` (client-safe; no node:fs).
- **NEW:** `PacketSpend` + `packetSpendSummary(source, prices?)` — reads `Project.tokenUsage`
  (`types.ts:435`) or a caller-threaded T-107.6 ledger; every number is a ledger field or a ledger-helper
  output; malformed/hostile fields refuse to surface (null, no section) rather than print garbage.
- **`compileAgentPacket(project, opts?)`:** `opts.spend` (caller-threaded ledger; wins over the persisted
  field — same "pre-mapped by the server-side caller" idiom as `opts.proven`) + `opts.spendPrices`
  (`TokenPrices`, caller-supplied per `token-ledger.ts` doctrine). A `## Measured spend` prose section
  renders ONLY when a usable ledger is present (absent ⇒ byte-identical output, the `opts.proven` idiom).
  The System JSON envelope gains an additive `spend` block (null when none — same null-default idiom as
  `verdict`/`rejection_loop`; T-14's `phase_coverage` is the post-v3 additive precedent; PACKET_VERSION
  stays 3 — `packet.test.ts:98` pins it and is not this lane's file).

## Honest limits of this pass (stated on purpose)

- No runs (owner rule). Syntax/type coherence argued from patterns; the parent boundary verifies.
- The doctor WIRING point for spend (`headless.doctorStatus`, read-only here) is out of this lane's box; the
  reader surface lands in `doctor.ts` ready for that copy (same as `tokenCap`'s path), and the packet seam
  is ready for a caller that holds the run ledger.
- `Project.tokenUsage` has no producer on disk today (B3 declared, nothing writes it) — the packet surfaces
  it when present and stays byte-identical when absent; the seam is the wiring point, not a claim that the
  number exists.

## Edits landed (authoritative file:line — re-derived post-edit)

### `src/lib/llm/providers/registry.ts` (666 lines total)

| Lines | What |
|---|---|
| `:35-45` | Header paragraph rewritten: OV-1 env selection LANDED; failover / autodetect / per-call telemetry stay deferred; F2's probe half noted. |
| `:211-274` | NEW banner + OV-1 block: `PROVIDER_ENV_VAR = "RAPIDTOOL_PROVIDER"` (`:216`), `DEFAULT_PROVIDER_ID = "deepseek"` (`:220`), `EnvProviderSelection` (`:232`), `resolveEnvProvider` (`:249`) — unknown id ⇒ `RT_E_VALIDATION` refusing message naming the registered ids; unset/blank ⇒ the default rung. |
| `:281-366` | `EnvSelectedRoute` (`:281`) + `resolveEnvSelectedRoute` (`:303`) — the ONE route branch (doctor + callModel share it); provider-scoped id validation; empty-namespace candidate ⇒ coded refusal naming the probe path; no-model default = the descriptor's own first request id (the `resolveExplicitProvider` rule). |
| `:625-649` | `callModel` — env-selection gate + route, AFTER the explicit-provider rung (precedence 1 wins) and BEFORE `resolveRoleModel`; unset ⇒ untouched byte-identical path; set+unknown ⇒ coded refusal before any I/O; set+other-provider ⇒ validated provider-scoped route. |

### `src/lib/doctor.ts` (677 lines total)

| Lines | What |
|---|---|
| `:23-30` | Header note: OV-1 envSelection + OV-41 spend reader. |
| `:36-37` | Imports: `estimateCostUsd` / `totalTokens` + `TokenLedger` / `TokenPrices` / `TokenSpend` from `./token-ledger.ts` (client-safe graph already declared). |
| `:66-71` | `DoctorFactory.spend: DoctorSpend` (`:69`). |
| `:272-278, :298` | `factoryClaim(evidence, env, spend?)` — optional 3rd ledger arg (`:278`); `spend: doctorSpend(spend)` (`:298`). |
| `:304-321` | `coerceFactoryClaim` doc: a raw blob can NOT mint spend (same anti-goal direction as productComplete). |
| `:339-344` | `doctorFactory(env, spend?)` — additive 2nd arg forwarded. |
| `:386-407` | `DoctorProviderTeam.envSelection` (`:397`) + `DoctorProviderEnvSelection` type (`:409`). |
| `:482` | `doctorProviderTeam` returns `envSelection: buildEnvSelection(registry, env)` — reads the registry's own resolvers. |
| `:487-552` | `shortLine` (`:487`) + `buildEnvSelection` (`:499`): keyed vs keyless from `Boolean(env[apiKeyEnv]?.trim())` (never the key value); `line` carries the literal **`cloud-by-default (RAPIDTOOL_PROVIDER unset ⇒ deepseek), keyless floor (… RT_E_LLM_NOT_CONFIGURED …)`** wording (`:530-550`); unknown id ⇒ refusal line "never silently defaulted to deepseek" (`:520-522`). |
| `:554-590` | OV-41 banner + `DoctorSpend` type (`:571`). |
| `:592-677` | `usablePrices` gate (`:595`), `usdAmount` (`:608`), `numOrNull` (`:612`), and `doctorSpend` (`:623`) — fields consumed directly; total via `totalTokens()` (`:656`); USD via `estimateCostUsd()` only under usable caller prices (`:658`); no ledger/hostile fields ⇒ `measured:false`, all-null, honest line (`:638`). |

### `src/lib/packet.ts` (993 lines total)

| Lines | What |
|---|---|
| `:6-11` | Imports: `estimateCostUsd` / `totalTokens` + ledger types (client-safe; no node:fs). |
| `:18-24` | `PACKET_VERSION` doc: additive `spend` block + optional section; version stays 3 (T-14 `phase_coverage` precedent; `packet.test.ts:98` pins 3 and is not this lane's file). |
| `:99-102` | `systemJson(...)` gains the `spend: PacketSpend \| null` parameter. |
| `:166-169` | Envelope gains `spend: spendBlock(spend)` — null when no measured sample (never a fabricated 0). |
| `:234-261` | `PacketSpend` type — `source: "token-ledger"`; fields + helper outputs only; cache fields nullable-by-shape. |
| `:263-355` | `packetPricesUsable` (`:265`), `packetNum` (`:275`), `packetUsd` (`:289`), `packetSpendSummary` (`:279` — reads `TokenSpend\|TokenLedger`, total via `totalTokens()` `:303`, USD via `estimateCostUsd()` `:305`), `packetSpendSection` (`:312` — prose, rendered only when spend present), `spendBlock` (`:331` — snake_case envelope block). |
| `:361-374` | `compileAgentPacket` opts: `spend?` + `spendPrices?` (additive; `opts.proven` idiom). |
| `:386-389` | `const spend = packetSpendSummary(opts?.spend ?? project.tokenUsage, opts?.spendPrices)` — caller ledger wins over the persisted slice (`types.ts:435`). |
| `:511-518` | `systemJson(...)` call threads `spend`. |
| `:671` | Prose splice: `...(spend ? packetSpendSection(spend) : [])` between the Scorecard block and `## Artifacts (trimmed)` — absent spend ⇒ byte-identical packet. |

## Verification that was allowed (no test/build runs)

- `node --experimental-strip-types --check` on all three edited files: **exit 0 ×3** (syntax sanity only — the wave plan's free allowance).
- Control cases (deliberately broken TS/JS in /tmp) both exit 1 — the checker demonstrably catches real syntax errors, so the exit-0s are meaningful.
- **Not run** (owner rule): `npm test`, `typecheck`, `lint`, `build`, any `node --test`. Type-level coherence was argued against the existing patterns (`resolveExplicitProvider`'s provider-scoped validation, `opts.proven`'s absent-⇒-byte-identical idiom, `phase_coverage`'s additive envelope precedent) and the read-only test surfaces (`doctor.test.ts` has no exact-key claim assertions; `packet.test.ts` parses named envelope keys and uses `.includes`).
- `files_modified` was verified by the patch tool on every hunk (`verified: true` / diff returned).

## Decisions worth review at the parent boundary

1. **`PACKET_VERSION` stayed 3.** Bumping to v4 would be the doctrinal move for an envelope addition, but `packet.test.ts:98` pins `3` and that file is not LANE 4's box (and no lane owns it this wave). Additive-key precedent (T-14's `phase_coverage`) supports staying at 3; if the parent prefers a v4 stamp, the one-line change + test update are cleanly separable.
2. **The "P6-only" scope label from OV-41's original ACCEPT is not hard-stamped** — T-107.6 has since widened recording across seams, and the packet reads whatever the ledger/project slice carries, so the section labels the provenance ("fields read back from the T-107.6 token ledger … the P6 synthesis path is the recording seam landed today") rather than over/under-claiming a fixed scope.
3. **`Project.tokenUsage` still has no producer on disk** (types.ts:435 declared for B3; repo-wide grep = that line only). The packet surfaces it when present and is byte-identical when absent; wiring a producer (headless/run-eval) is outside this lane's box.
4. **`headless.doctorStatus` is untouched** (read-only for this lane) — `DoctorFactory.spend` + `doctorSpend()` land doctor-side, ready for that summary's copy, exactly as `tokenCap` reached it.
5. **env-selected non-tier providers route through provider-scoped ids** (the `resolveExplicitProvider` no-model rule = descriptor's own first request id). Today's only such provider, `xai`, is a candidate with 0 ids ⇒ a coded refusal naming the probe path (honest today; a verified descriptor becomes selectable with no code change).
