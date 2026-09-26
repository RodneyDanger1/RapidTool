# 258 · W21 LANE 2 — FINISH F2 (provider box: the half-applied fix completed, box type-clean, suites green)

**Status: LANDED.** Owner: W21-L2. Read first: `wave_plans/W21/fix-wave.md` §LANE 2; inputs `fixes/255_lane4_t51_f2.md`
(arrived a 1,476 B skeleton), `fixes/252_lane5_f2.md` (also a skeleton on arrival), `research/multiagent/221_feature_designs.md` §F2.
**Box (owned):** `src/lib/llm/providers/*` — `registry.ts` (+ `registry.test.ts`, where the W21-L2 pins were added),
`openai-compatible.ts` (the fix), `probe.ts`, `deepseek.ts`/`mock.ts` untouched. **Scratch:** `C:/Users/mnril/w21l2_scratch/`.
**Forbidden obeyed:** no `npm run typecheck/test/build`; every node run FOREGROUND; tsc invoked directly (scoped, scratch config).

## BOTTOM LINE

1. **Arrival state ≠ the brief's "29".** The box carried **exactly ONE** scoped-typecheck error on arrival — the
   TS2322 at `openai-compatible.ts(163,3)` (`id: string` ⊄ `LlmProviderId`) — i.e. precisely the **half-applied
   W20-L4 fix** (`LlmProviderId` imported but never used). The other 28 of the historical 29 are not reproducible
   on disk: W20-L4's repairs (registry.ts/registry.test.ts/mock.test.ts, 18:01–18:10 mtimes) landed and no tsc
   artifact enumerating "29" exists anywhere in the repo or either lane's scratch (searched). Honest reading:
   W19 left 29; W20-L4 fixed all but this one and died before verifying. I enumerated the CURRENT set with a
   scoped typecheck (1 → after fix **0**), not a reconstructed 29.
2. **The half-applied fix is COMPLETE**: `OpenAiCompatibleSpec.id` is now typed `LlmProviderId` (the import W20-L4
   added is now load-bearing) — TS2322 gone, behavior unchanged (type-only). Scoped typecheck: **exit 0 · 0 errors**.
3. **Suites (FOREGROUND, final bytes):** `registry.test.ts` **39/39** (29 base + 8 F2 + **2 new W21-L2 pins**) ·
   `llm.test.ts` **14/14** · `mock.test.ts` **12/12** (its PROVIDERS census pin intact). `eslint` on the two edited
   files: exit 0, zero problems — ledger #68's five unused-import warnings are no longer present in the current
   bytes (all five symbols are used; re-verified with a direct eslint run on this tree, not assumed).
4. **Found + closed a declare-or-strike gap in-box:** `openai-compatible.ts`'s header claims its keyless floor and
   the no-silent-`thinking`-translation rule are "pinned by a test" — **no such test existed**. Two pins added;
   a mutation check (translate `thinking`→`reasoning_effort`) turned the wire pin **RED**, then the source was
   restored byte-identically (`RESTORED-OK`) — the pins are load-bearing, not decoration.
5. **Live-probe evidence re-derived + on disk** (`w21l2_scratch/live_*`): 401s on `/v1/models` + `/v1/chat/completions`,
   400 on empty messages, 404 on `/v1` root, docs sentence + quickstart env var + openapi paths — all match the
   module header byte-for-byte (§4).
6. **p6 §P1/§P2 (from `fixes/255_lane2_probe_truth.md`) LEFT FOR THE PARENT** — outside this box (`src/lib/dod.ts` /
   `doctor.test.ts`), §P2 needs an owner ruling (pinned opposite by W18-OV-9), and both are verdict-changing for
   `npm run eval` — unsafe to land in the fix-wave whose goal is a clean keyed run (#3). Reasons in §5.
7. **No half-applied state left**: `git status` on the box shows exactly the expected set (§3e); no files added or
   removed by this lane; mutation cycle restored byte-identically.

## §0 Arrival state (git evidence)

```
 M src/lib/llm/providers/registry.ts          (12:46 mtime — W19-L5's F2 registration, complete-looking diff)
 M src/lib/llm/providers/registry.test.ts     (18:05 — +277 lines: F2 pins + census rework; no pin weakened, checked)
 M src/lib/llm/providers/mock.test.ts         (18:01 — census pin repaired by W20-L4, ledger I2)
?? src/lib/llm/providers/openai-compatible.ts (18:10 — the half-applied fix: LlmProviderId imported, unused)
?? src/lib/llm/providers/probe.ts             (14:38 — complete; pinned by registry.test.ts)
```
Historic-count provenance: `grep -rn "29 latent|latent type" fixes/` → only W21's own plan; W20-WD `fixes/256`
captures lint/TAP, never a tsc error list. So the 29 figure traces to the W19/W20 lane reports, not to a
re-runnable artifact — recorded here rather than reconstructed.

## §1 Enumeration (scoped typecheck — the W17-L2/L5 + W20-L4 pattern)

Scratch config `C:/Users/mnril/w21l2_scratch/tsconfig.scoped.json` (extends the repo's tsconfig; `include` =
`providers/**/*.ts` + `src/lib/llm.ts` + `src/lib/llm.test.ts`; `types:["node"]` + repo `typeRoots` — the exact
override shape W20-L4 used in `tsconfig.lane4.json`; the box uses no vite/client ambient types).

```
BEFORE (raw, head of tsc_before.txt)
../Desktop/RapidTool Main/src/lib/llm/providers/openai-compatible.ts(163,3): error TS2322: Type 'Readonly<{ id: string; label:
string; apiKeyEnv: string; … }>…' is not assignable to type 'LlmProviderDescriptor'.
  Types of property 'id' are incompatible.
    Type 'string' is not assignable to type 'LlmProviderId'.
→ 1 error TS   (exit 2)
```
("29" not reproducible — see Bottom line 1. The scoped program also transitively checks `llm.ts`, `llm-tasks.ts`,
`deepseek.server.ts`, `errors.ts` — all clean.)

## §2 Fixes + rationale

1. **`openai-compatible.ts`** — `OpenAiCompatibleSpec.id: string → LlmProviderId` (+ doc comment). Completes the
   half-applied fix; no cast, no `any`; the union stays closed/additive per registry.ts's own comment ("Additive:
   one per provider file under this dir"). No runtime change (type-only; mutation-restore proved byte identity).
2. **`registry.test.ts`** — +2 pins, inside the F2 describe block, making `openai-compatible.ts`'s header claims
   load-bearing (they were unpinned — a silent `thinking→reasoning_effort` translation was INVISIBLE):
   - *adapter floor*: keyless ⇒ exact legacy envelope (`reason:"not-configured"`, `RT_E_LLM_NOT_CONFIGURED`) with
     zero I/O even on a fully verified descriptor; an id no probe returned (`gpt-4o`) and an absent id both ⇒
     `RT_E_VALIDATION` before any request.
   - *adapter wire*: verified id ⇒ `POST https://api.x.ai/v1/chat/completions`, `Bearer` key from `XAI_API_KEY`,
     `max_completion_tokens` ONLY when passed, never `max_tokens`, **never** a reasoning field with `thinking:true`,
     `response_format` only with `json:true`.
   Both dispatch through the blessed `callModel` seam (the provider-scoped-id cast stays confined to registry.ts:458
   — no new casts anywhere).
3. Nothing else was changed; `deepseek.ts`, `mock.ts`, `registry.ts`, `probe.ts` untouched by this lane.

## §3 Verification (FOREGROUND; raw results)

a) **Scoped typecheck — final (this exact tree):**
```
cd /c/Users/mnril/w21l2_scratch
node "C:/Users/mnril/Desktop/RapidTool Main/node_modules/typescript/bin/tsc" -p tsconfig.scoped.json
→ tsc exit=0 · 0 errors     (tsc_final2.txt; capture after every edit)
```
**Re-verified on the frozen final bytes (this pass):** scoped tsc exit=0 · 0 errors (`w21l2_scratch/verify_tsc.txt`).
Byte pins of the changed sources: `openai-compatible.ts` sha1 `4e40abec…` · `registry.test.ts` sha1 `345ce117…` ·
`registry.ts` sha1 `2278d988…` (untouched by this lane, listed for completeness). No `npm run typecheck|test|build`
was executed anywhere in this lane (FORBIDDEN — the armed watcher owns the full run; other lanes are mid-edit).
b) **Suites — final:**
```
node --experimental-strip-types --test src/lib/llm/providers/registry.test.ts  → # tests 39 · # pass 39 · # fail 0
node --experimental-strip-types --test src/lib/llm.test.ts                     → # tests 14 · # pass 14 · # fail 0
node --experimental-strip-types --test src/lib/llm/providers/mock.test.ts      → # tests 12 · # pass 12 · # fail 0
```
   (registry base was 29/29; F2 added 8; this lane added 2 ⇒ 39. llm/mock counts unchanged from base.)
c) **Lint (direct eslint, zero-problems bar):** `node node_modules/eslint/bin/eslint.js <registry.test.ts openai-
   compatible.ts>` → **exit 0** (ledger #68's 5 warnings no longer present in the current bytes).
d) **Mutation RED check (new pins are load-bearing):** injected `reasoning_effort` when `opts.thinking` →
```
MUTATED
    not ok 6 - the adapter wire: the verified id dispatches to the probed base — no reasoning knob, …
# fail 1
RESTORED-OK        (cmp vs the pre-mutation copy: byte-identical)
```
e) **Final box status (nothing stray; no half-applied edits):**
```
 M mock.test.ts   M registry.test.ts   M registry.ts   ?? openai-compatible.ts   ?? probe.ts
```
f) **Out-of-box read-only goodwill check (helps RUN3 readiness):** W20-L4's `tsconfig.scoped.json`
   (chat.ts + chat.test.ts, the other dead pickup) re-run in FOREGROUND → **exit 0, no diagnostics** — T5.1's
   partial edits are type-clean. Not my box; reported, not touched.

## §4 Live-probe evidence (re-derived 2026-09-24, raw; scratch `w21l2_scratch/`)

```
$ curl -sS https://api.x.ai/v1/models            → HTTP 401  {"code":"unauthenticated:no-credentials","error":"No credentials presented."}
$ curl -sS -X POST https://api.x.ai/v1/chat/completions -d '{"model":"grok-4","messages":[{"role":"user","content":"hi"}]}'
                                                   → HTTP 401  (same body; endpoint EXISTS, auth-gated)
$ curl -sS -X POST … -d '{"model":"grok-4","messages":[]}'  → HTTP 400  {"code":"400","error":"Bad data: Messages cannot be empty"}
                                                   (rejected BEFORE auth — matches the module header's claim)
$ curl -sS https://api.x.ai/v1                     → HTTP 404  "The requested resource was not found. …"  (base is /v1 + path)
$ curl -sSL https://docs.x.ai/llms.txt             → "The API is served at https://api.x.ai."  (+ openapi.json link)
$ curl -sSL .../chat-completions.md                → "The Chat Completions API is the stateless, OpenAI-compatible predecessor of the
                                                      Responses API" · "## POST /v1/chat/completions" · max_completion_tokens present
$ curl -sSL .../quickstart.md                      → export XAI_API_KEY="your_api_key"
$ curl -sSL https://docs.x.ai/openapi.json  (222,498 B) → paths include "/v1/chat/completions" and "/v1/models";
                                                      /v1/models GET security: [{bearerAuth:[]}]
```
Corroboration: W20-L4's raw copies still on disk (`w20l4_scratch/live_cc.txt` = the 400, `live_cc2.txt` = the 401).
The 8 F2 pins in registry.test.ts replay the 401 byte-for-byte and hit `XAI_MODELS_ENDPOINT` — all green.

## §5 Notes / risks / EXT-FAIL

- **[no new EXT-FAIL rows]** — nothing in the box failed after the fix; `fixes/257_error_ledger_v3.md` untouched
  by this lane (its #68 row is now satisfiable: the file's warnings are gone — verified, not assumed).
- **Recorded for the parent (not EXT-FAILs):** (i) the "29" count has no on-disk artifact (Bottom line 1);
  (ii) `fixes/252_lane5_f2.md` + `fixes/255_lane4_t51_f2.md` are still skeletons — their lanes died pre-landing;
  the facts live in bytes, which is why this log carries the evidence instead.
- **p6 §P1/§P2 left for the parent — reasons:** not in this box (`src/lib/dod.ts`, `gates.test.ts`, `doctor.test.ts`);
  §P2 is explicitly "needs an owner ruling" (W18-OV-9 pinned the opposite in `doctor.test.ts:383-395`, which is the
  known live-artifact-dependent red — EXT-FAIL row 1 of `fixes/255_lane2_probe_truth.md`); both change gate
  verdicts, and RUN3 must land on the unmodified semantics of the tree this wave is fixing. If the parent wants
  P1 landed, it is a 4-line edit + gate-suite re-run, best done AFTER run #3.
- **Adapter coverage note (honest):** the adapter's inner `requestModelIds.includes` guard is unreachable through
  TYPED call sites (the registry refuses first — pinned via `callModel`); it is defense-in-depth for untyped/JS
  callers and deliberately not cast-tested. The retry/timeout matrix of `completeOpenAiCompatible` rides the same
  `getResponseWithRetry` policy as DeepSeek but has no xAI-specific 429/5xx pin yet — **next-wave candidate**, not
  a claim made anywhere.
- **Claim corrections:** none needed in-module — the header's "pinned by a test" claim is now TRUE (was not before
  this lane). The `LlmProviderId` import added by W20-L4 now has a consumer (was dead).

## Claims vs bytes (self-check)

- "Scoped typecheck 1→0, exit 0" → tsc_before.txt / tsc_final2.txt captures, commands above. ✅
- "39/39 + 14/14 + 12/12" → final_reg/llm/mock.txt captures, FOREGROUND, this tree. ✅
- "pins are load-bearing" → mutation RED transcript + RESTORED-OK cmp. ✅
- "probe raws re-derived" → files on disk + raw text pasted; W20-L4's copies corroborate. ✅
- "no lazy any / no stubs" → diff is a type annotation + comments + tests; no mocks added; no `any` cast added. ✅
- "no half-applied edits left" → §3e status + byte-identical restore + scoped tsc 0 on final bytes. ✅
