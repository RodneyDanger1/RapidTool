# 216p — Provider registry + role tiers (W5 · LANE 4): T-107.2 — COMPLETE

**Status:** COMPLETE. Code landed by W5-L4 (registry + seams), tests + doctor surfacing by W6-L3,
the mock provider by W7-L4; parent boundary repairs in W6/W7; this body was assembled by
**W8-L2** (2026-09-17) from the lane summaries (`subagent-summary-3-20260916_213829_505012.txt` =
W5-L4; `subagent-summary-2-20260916_220208_508348.txt` = W6-L3; `subagent-summary-3-20260917_083223_112728.txt`
= W7-L4 mock) and **re-verified from fresh runs made in the W8-L2 session** — every number in §3 is
that run's real output. Run logs kept at `C:\Users\mnril\_w8l2\`.

**Owned files:**
- `src/lib/llm/providers/deepseek.ts` — NEW (provider port)
- `src/lib/llm/providers/registry.ts` — NEW (registry: providers + roles + explicit-model rule)
- `src/lib/deepseek.server.ts` — migrated to a thin re-export (exports stable)
- `src/lib/llm.ts` — role-tier API added
- `src/lib/verify.server.ts` / `src/lib/chat.server.ts` / `src/lib/crew.server.ts` — seam switches
- `src/lib/llm/providers/registry.test.ts` (W6-L3) + `src/lib/llm/providers/mock.ts` /
  `mock.test.ts` (W7-L4)
- `src/lib/doctor.ts` + `src/lib/verify.server.test.ts` / `src/lib/chat.test.ts` / `src/lib/crew.test.ts`
  (migration pins only)
- `fixes/216p_provider_registry.md` (THIS file)

**Deferred hops (list, do NOT touch):**
- `src/lib/codegen.server.ts` seam (L1-owned) — still calls `completeDeepSeek` (verified on disk:
  import :93, `complete: completeDeepSeek` :1973). Listed for a later wave (§4.1).
- `src/lib/doctor.ts` provider/model surfacing — landed as `doctorProviderTeam`; the CONSUMER
  wiring is still open (§4.2).

**Findings served:** 107 T-107.2; 103 A1 (first step); 100 P0-03 (tier vocabulary).

---

## 1. Design (decided BEFORE code)

- **Provider = descriptor object**, not a name string: `deepseek.ts` is a verbatim port of the old
  `deepseek.server.ts` body (diff proved only the header comment + two import lines differ), with
  every historical export preserved. `deepseek.server.ts` becomes a thin re-export so all legacy
  importers keep working byte-identically.
- **Roles, not model ids, at call sites:** `RapidToolModelRole = "main" | "reasoning" | "weak"`
  (`RAPIDTOOL_MODEL_ROLES` = canonical order). `ROLE_TIERS` (registry.ts :240-257):
  `main → deepseek-v4-flash` ("never silently swap to pro"), `reasoning → deepseek-v4-pro`
  (thinking enabled), `weak → deepseek-v4-flash` (cheapest structured-envelope tier).
- **Explicit-model rule:** precedence **call-site model > env pin > tier default**; an unknown /
  blank / non-string id is REFUSED with `RT_E_VALIDATION` naming `KNOWN_MODEL_IDS` — never a silent
  default. Env pins: `DEEPSEEK_MODEL_MAIN` / `_REASONING` / `_WEAK` (`roleModelEnvKey`).
  `deepseek-v4-flash-vision-exp` is deliberately NOT requestable (request-path acceptance
  unverified).
- **Three free seams switched** (verify → `weak`, chat → `main`, crew → role-bound via
  `crewRoleForModel` + `crewRegistryCompleter`); codegen deliberately deferred (L1-owned).
- **Doctor surfacing is ADDITIVE:** `DoctorProviderEntry` / `DoctorProviderTier` /
  `DoctorProviderTeam` + async `doctorProviderTeam(env)` behind the same lazy `import()` seam the
  other server-only reads in `headless.doctorStatus` use — the module's static graph stays
  `sandbox-policy` + `token-ledger` (client-safe; no `node:fs`, no key read at import). The API-key
  VALUE never enters the envelope (only `Boolean(env[apiKeyEnv]?.trim())`). Keyless stays honestly
  not-configured with the historical label string.
- **Mock provider (W7-L4): its OWN namespace** — `MOCK_PROVIDER_ID = "mock"`,
  `MOCK_MODEL_ID = "mock-canned-v1"`, explicit-selection-only (`RAPIDTOOL_MOCK_LLM=1` +
  `selectMockProvider`), `isConfigured()` hard-wired `false`, an exhausted queue returns
  `RT_E_LLM_REJECTED` naming the mock (never fabricated text). The registry gained an additive
  explicit-provider branch (`resolveExplicitProvider`; `LlmProviderId` widened with `"mock"`;
  `CallModelOptions.provider`) so `getProvider("mock")` stays `undefined` (never a DeepSeek alias)
  while an explicitly-passed descriptor remains dispatchable.

## 2. Work log (append-only)

1. **W5-L4 (code):** ported `deepseek.ts` verbatim; authored `registry.ts` (roles, `PROVIDERS`,
   `getProvider` → `undefined` on unknown (never a fallback), `ROLE_TIERS`, `roleModelEnvKey`,
   `KNOWN_MODEL_IDS`, `resolveRoleModel`, `callModel` stripping caller overrides so only the
   validated id is sent); `deepseek.server.ts` → re-export; `llm.ts` role-tier API
   (`callModelServer`/`callModel`, `RapidToolModelRole` re-export); switched
   verify/chat/crew seams. Isolated port check: deepseek 21 + llm 14 = **35/35** (the historical
   tests pass UNTOUCHED ⇒ byte-compatible port). Tests + log owed (budget death).
2. **W6-L3 (tests + doctor):** NEW `src/lib/llm/providers/registry.test.ts` — 4 suites / 21 tests:
   lookup (descriptor fields + unknown⇒`undefined` for `''`, `' '`, `'openai'`, `'DeepSeek'`,
   `'deepseek '`, `' deepseek'`, non-strings — never a fallback); role vocabulary (exactly
   main/reasoning/weak, frozen, hostile-value guard); tier table frozen with `main` = flash
   (never silently pro); `roleModelEnvKey` ⇒ `DEEPSEEK_MODEL_MAIN/_REASONING/_WEAK` (+`null` for
   unknown role); precedence call-site > env pin > tier; blank pin ⇒ unset; explicit-model rule
   (every `KNOWN_MODEL_IDS` entry resolves; the UNVERIFIED `deepseek-v4-flash-vision-exp` is NOT
   requestable; version-tagged / `deepseek-chat` / `deepseek-reasoner` / `gpt-9` refused with
   `RT_E_VALIDATION` naming both known ids; blank/non-string refused); `callModel` over an INJECTED
   fetch seam (no global stub) — unknown id refused with ZERO network calls, `main`⇒flash body
   shape (max_tokens 1024 / thinking disabled / stream false), validated pro override ⇒ the full
   pro shape (thinking enabled + reasoning_effort high + 8192), a valid env pin changes the
   requested id, keyless ⇒ exact `{ok:false, reason:'not-configured', code:'RT_E_LLM_NOT_CONFIGURED'}`
   with zero fetch. Migration pins APPENDED (nothing weakened): verify.server.test.ts **19 → 20**,
   chat.test.ts **69 → 70**, crew.test.ts **45 → 46**. `doctor.ts` +95 lines: the additive
   provider-team envelope (:286-370, `doctorProviderTeam` :328).
3. **W6 parent repair — doctor type-only import:** the surfacing used `RapidToolModelRole` without
   an import (TS2304 in the W6-L2 lane's typecheck). Parent added the TYPE-ONLY import at
   `doctor.ts:26-28` (`import type { RapidToolModelRole } from "./llm/providers/registry.ts"`) —
   erased at compile, so `doctor.ts`'s client-safe static runtime surface is unchanged.
4. **W6 parent repair — `gate.sh` nested-test glob:** `scripts/gate.sh` :90/:99 now read
   `"src/lib/**/*.test.ts"` (was `src/lib/*.test.ts`) — the registry suite at
   `src/lib/llm/providers/registry.test.ts` was INVISIBLE to every sweep before this fix.
5. **W7-L4 (mock, `fixes/216t` scope):** `mock.ts` + `mock.test.ts` + the additive registry patch
   (see Design).
6. **W7 parent boundary repairs** (recorded here — they sit on the mock/registry-adjacent files):
   - **mock import paths:** the new modules' relative imports were written with wrong depth;
     parent corrected them to the sibling/level-correct forms — current on-disk:
     `mock.ts:36-39` → `../../errors.ts`, `../../llm.ts`, `./deepseek.ts`, `./registry.ts`;
     `mock.test.ts:39/:47` → `./mock.ts`, `./registry.ts`.
   - **`LlmResult.model`:** the ok arm now carries the serving model id as a required field
     (`llm.ts:31-38`); producers aligned — `mock.ts` envelope copy (:86-91 `model: env.model`) and
     the served-reply tail (:120 `model: next.model ?? MOCK_MODEL_ID`), `crew.test.ts` `okText`
     (:32-34), the `codegen.server.test.ts` fakes.
   - **`error?` guards:** refusal-arm fields only spread when present (`mock.ts:82`
     `...(env.error ? { error: env.error } : {})`) and readers fall back (`subagent.ts:553`
     `res.error ?? \`provider refused (${res.reason})\``) — no `undefined` leaks into `error?: string`.
   - **`role: null` mapping:** `subagent.ts:547-550` — `NormalizedTask` carries `role: string | null`
     while the completer contract takes the optional-field input shape; mapped back to absent at
     that ONE seam (`role: task.role ?? undefined`), no contract change. (Comment on disk names it a
     parent boundary fix.)
   - **`_lessons`:** `mock.test.ts:366` — the E2E expand seam's unused param renamed to `_lessons`
     to match `codegen.server.ts:1849`'s `expand: (brief: string, lessons?: readonly string[])`
     contract and keep lint clean.
   Result of the W7 repair sweep: typecheck **0**; subagent **22/22** + mock **12/12** + registry
   **21/21**.

## 3. Verification (real command output — W8-L2 re-runs, 2026-09-17)

```text
$ node --experimental-strip-types --test src/lib/llm/providers/registry.test.ts
exit=0
# tests 21
# suites 4
# pass 21
# fail 0
# skipped 0

$ node --experimental-strip-types --test src/lib/verify.server.test.ts
exit=0
# tests 20
# suites 7
# pass 20
# fail 0

$ node --experimental-strip-types --test src/lib/chat.test.ts
exit=0
# tests 70
# suites 13
# pass 70
# fail 0

$ node --experimental-strip-types --test src/lib/crew.test.ts
exit=0
# tests 46
# suites 12
# pass 46
# fail 0

$ node --experimental-strip-types --test src/lib/doctor.test.ts
exit=0
# tests 15
# suites 1
# pass 15
# fail 0
  # (count UNCHANGED — not grown; doctorProviderTeam has zero pins, see §4.4)

$ node --experimental-strip-types --test src/lib/llm/providers/mock.test.ts
exit=0
# tests 12
# suites 3
# pass 12
# fail 0

$ npx tsc --noEmit
typecheck exit=0
error TS lines: 0
```

**W6-L3-era baselines for the record (from the lane summary, pre-final):** registry 21/21 /
verify 20/20 / chat 70/70 / crew 46/46 all confirmed then; doctor was 15/15 NOT grown. The W7
boundary sweep totals (parent): src **1894/1894** (+53 = compaction 19 + subagent 22 + mock 12).
All of the above numbers in §3 were re-derived by W8-L2 this session.

## 4. Deferred-hops list + follow-ups

1. **`codegen.server.ts` seam — still on `completeDeepSeek`** (import :93, `complete: completeDeepSeek`
   :1973). Deliberately untouched (L1-owned during the provider waves). Swap it to the registry's
   role path in a later wave.
2. **`doctorProviderTeam` has NO consumer yet** — exported at `doctor.ts:328`;
   `grep -rn doctorProviderTeam src scripts` hits ONLY `doctor.ts`. Not wired into
   `headless.doctorStatus` / the CLI `doctor` output. The additive envelope exists; surfacing
   wiring is open (it lives in `headless.ts`, another lane's file during W6).
3. **`npm test` glob gap (parent decision needed):** `scripts/gate.sh` now sees
   `src/lib/**/*.test.ts` (fixed), but `package.json` `"test"` (line 19) still globs
   `src/lib/*.test.ts` + app-data + auth only — so `registry.test.ts` and `mock.test.ts` are NOT in
   the `npm test` src leg. (Flagged by W7-L4; not edited there because scripts/package.json were
   outside its ownership.)
4. **`doctor.test.ts` not grown (15/15):** `doctorProviderTeam` has no pins — a follow-up test
   should pin the tier fields (role/provider/envKey/model/pinned/error), the keyless label
   byte-identity, and the unknown-pin ⇒ refusal-not-substitution behaviour.
