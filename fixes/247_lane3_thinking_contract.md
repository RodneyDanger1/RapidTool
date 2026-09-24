# fixes/247 — LANE 3 · the thinking/provider contract trio (OV-36 + OV-28 test-pin + OV-37)

**Lane:** W17 LANE 3 (`wave_plans/W17/lanes-and-watchdog.md` §LANE 3). **Base:** 4328d20 (clean).
**Owns:** `src/lib/llm-tasks.ts`, `src/lib/llm/providers/registry.ts` (+ `registry.test.ts`), `src/lib/llm/providers/deepseek.ts`. Nothing else was edited.
**Read first:** LANE 3 block; 227 §2b (Q2b trace) + §2c + §6 row text; 228 §3 #8/#9/#10; 240 §2 (row homes/verification). *(Note: `230_task_execution_playbook.md` covers OV-1…OV-18 only — it predates these ids; grep: `0` hits for OV-28/36/37. The authoritative row text is 227 §6 / 228 §3.)*

## BOTTOM LINE
**(a) OV-36 — DONE** — all three pro-tier sites now carry an explicit, per-site `thinking` decision in the request opts (not a blind disable): site 1 `thinking: false` (json envelope — the fixes/156 E1 rule), sites 2+3 `thinking: true` (prose — pinned with written justification). Each is test-pinned (site → opts → wire body).
**(b) OV-28 — DONE (test-pin half only)** — 3 body-shape pins at the registry boundary; zero behaviour change (the force/refuse arm still waits on the owner's tier intent, 228 §3 #9).
**(c) OV-37 — DONE** — every refusal now names the requested id (`… — requested model: "<id>"`, alongside the vendor text, nothing parsed) + the refresh procedure (`/models` cross-check + which constants to update) is documented at `DEEPSEEK_MODELS`. No silent fallback anywhere.
**Verification:** `registry.test.ts` **29/29 green** (foreground; 21 pre-existing + 8 new pins); `llm-tasks.test.ts` 17/17, `deepseek.server.test.ts` 21/21, `prompt-engine.test.ts` 28/28, `llm.test.ts` 14/14 — all green after the change.
**Falsifiability:** three scratch flips each produced RED on exactly the intended pins (FLIP A provider thinking branch, FLIP B site-1 decision, FLIP C alias-death clause) — outputs in `C:/Users/mnril/w17l3_scratch/flip{A,B,C}_registry_red.txt`.
**Cross-lane observation (NOT mine, do not attribute to this lane):** `src/lib/scaffold.ts:741` (LANE 4's in-flight G5 edit) currently fails type-stripping → `mock.test.ts` 11/12. Root cause + file attribution in §6 below.

## §1 · Per-site decision (OV-36) — stated as the row requires
| site | final line | opts sent | decision + why |
|---|---|---|---|
| `extractConstraints` | `llm-tasks.ts:133` | `{ model: "deepseek-v4-pro", json: true, thinking: false }` | **OFF** — the structured json envelope must spend its output budget on the payload, not chain-of-thought (fixes/156 E1's rule; 227 §2b names this exact `json:true` + pro shape as the live E1 home). |
| `interpretFeedback` | `llm-tasks.ts:164` | `{ model: "deepseek-v4-pro", thinking: true }` | **ON, pinned explicitly** (not left to the vendor default) — written justification: the reply is 2–4 sentences from a ≤4000-char note, so E1's large-prompt window-starvation mode is not in play; interpreting a rejection benefits from reasoning. The pin makes any future default flip visible instead of silent. |
| `phaseNarrative` | `llm-tasks.ts:193` | `{ model: "deepseek-v4-pro", thinking: true }` | **ON, pinned explicitly** — same justification (one paragraph from a ≤2000-char grounded brief). |

`CompleteOptions` gained `thinking?: boolean` (`llm-tasks.ts:57`) so the decision rides the request opts; the provider can only ever turn pro OFF (flash keeps its disabled shape). Keyless behaviour unchanged (all 17 existing `llm-tasks.test.ts` tests green, incl. the `completeDeepSeek` mocked-fetch block).

## §2 · Evidence ledger (each claim = the command that produced it)
```bash
# fresh re-verification after all work landed (2026-09-24 13:52:51), saved:
# C:/Users/mnril/w17l3_scratch/w17l3_fresh_verify.txt
node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts    # 29/29
node --experimental-strip-types --test --test-concurrency=2 src/lib/llm-tasks.test.ts                 # 17/17
node --experimental-strip-types --test --test-concurrency=2 src/lib/deepseek.server.test.ts           # 21/21
node --experimental-strip-types --test --test-concurrency=2 src/lib/prompt-engine.test.ts             # 28/28
node --experimental-strip-types --test --test-concurrency=2 src/lib/llm.test.ts                       # 14/14
# (109 tests total, 0 fail — foreground; full gates are parent/boundary-only this wave, see §7)
# scoped lint (allowed; `npm run typecheck|test|build` are the forbidden set) — saved: w17l3_verify_turn3.txt
./node_modules/.bin/eslint src/lib/llm-tasks.ts src/lib/llm/providers/registry.ts src/lib/llm/providers/registry.test.ts src/lib/llm/providers/deepseek.ts
#   → exit 0, no output (clean); re-ran the 5 suites at 13:53:28 → 29/17/21/28/14, 0 fail
# final green run before that (13:52:12), saved: C:/Users/mnril/w17l3_scratch/w17l3_final_green.txt
node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts
#   → # tests 29 / # pass 29 / # fail 0
node --experimental-strip-types --test --test-concurrency=2 src/lib/llm-tasks.test.ts        # 17/17
node --experimental-strip-types --test --test-concurrency=2 src/lib/deepseek.server.test.ts  # 21/21
node --experimental-strip-types --test --test-concurrency=2 src/lib/prompt-engine.test.ts    # 28/28  (asserts /HTTP 400/ — kept matching)
node --experimental-strip-types --test --test-concurrency=2 src/lib/llm.test.ts              # 14/14
# diff surface (exactly this lane's box):
git diff --stat -- src/lib/llm-tasks.ts src/lib/llm/providers/registry.ts src/lib/llm/providers/registry.test.ts src/lib/llm/providers/deepseek.ts
#   llm-tasks.ts 25+ · deepseek.ts 22+/6- · registry.test.ts 240+ · registry.ts 5+/1-  (286 insertions, 6 deletions)
```
`registry.test.ts` additions: **§5 OV-28** (3 boundary pins), **§6 OV-36** (3 site pins: opts captured verbatim + wire body through `completeDeepSeek` with an injected fetch), **§7 OV-37** (2 pins: 400 names the requested id / the named id is the resolved one). Helper added: `rejectionFetch` (one Response, no retry).

## §3 · Falsifiability — the scratch flips (all reverted; scratch is outside the repo)
- **FLIP A** — `deepseek.ts`: `...(opts.thinking === false || !isPro` → `...(!isPro` (the thinking field's explicit-off branch). Ran `registry.test.ts` → **RED, 2 fail**: `not ok 2 - an explicit thinking:false crosses the boundary verbatim` (`+ type: 'enabled' / - type: 'disabled'`) and `not ok 1 - site 1 · extractConstraints … disabled wire shape`. → `flipA_registry_red.txt` (exit=1).
- **FLIP B** — `llm-tasks.ts`: removed `thinking: false` from site 1 → **RED**: `site 1's decision is explicit in the request opts`, actual `{ json: true, model: 'deepseek-v4-pro' }` (missing `thinking: false`). → `flipB_registry_red.txt`.
- **FLIP C** — `deepseek.ts`: removed the requested-id clause → **RED**: `the requested id is named verbatim`, actual `'DeepSeek rejected the request (HTTP 400: Model Not Exist)'` — i.e. the old id-less refusal shape. → `flipC_registry_red.txt`.
So: the body-shape pins fail if the thinking field flips (A), the site pins fail if a site decision flips (B), and the alias-death pin fails without the id (C).

## §4 · OV-37 — the alias-death contract as landed
- Refusal (`deepseek.ts:428`): `` `${await describeError(res)} — requested model: "${model}"${exhausted}` `` — the requested id rides **every** non-OK refusal next to the vendor's own text. No prose parsing, no classification branch, no fallback: a dead alias reads e.g. `DeepSeek rejected the request (HTTP 400: Model Not Exist) — requested model: "deepseek-v4-pro"`.
- Refresh path (`deepseek.ts:39-52`, beside `DEEPSEEK_MODELS` — where the ids are documented): `curl -s https://api.deepseek.com/models -H "authorization: Bearer $DEEPSEEK_API_KEY"` then update `DEEPSEEK_MODELS` (→ `DEEPSEEK_MODEL_IDS`, and `DEEPSEEK_REQUEST_MODEL_IDS`/`KNOWN_MODEL_IDS` in registry.ts follow). Pointer added at `registry.ts:100-102`.
- Deliberately NOT done (row's done-when doesn't ask for it): comparing requested vs served ids on success — that would be a behaviour change; out of scope for this S row.

## §5 · Notable decisions / honest limits
- **Test-file placement:** OV-36's site pins ride in `registry.test.ts` (this lane's test file) — `llm-tasks.test.ts` was outside the lane's ownership box ("Nothing else"). The pins drive `createLlmTasks` from there and assert both the exact opts object and the resulting wire body, so the site → opts → body chain is covered end to end without touching an unowned file.
- No `npm run typecheck|test|build` was run (forbidden); all runs were `node --experimental-strip-types --test` foreground. The patch tool's auto-lint complained `TS6053 … not found` on every edit — a space-in-path artifact of the runner, not a real error (the same files load and test green).
- Keyless-only host: wire-side acceptance of the `thinking`/`model` shapes remains UNVERIFIED against the live API (unchanged by this lane; Step 0 is the first wire contact).

## §6 · Cross-lane observation — `scaffold.ts:741` mid-edit (NOT this lane)
- Evidence: `node --experimental-strip-types -e "import('./src/lib/scaffold.ts').catch(e=>console.log(e.stack))"` → `SyntaxError [ERR_INVALID_TYPESCRIPT_SYNTAX]: Expected ',', got 'ident'` at **`src/lib/scaffold.ts:741`**, the line `` `  throw new Error(\\`${emittedRefusal("TODO(E-15) stub: implement")}\\${method}\\${path}\\`);` `` (a double-backslash before the nested backtick closes the template literal early).
- Attribution: the file's diff is LANE 4's G5 work (`git diff --stat -- src/lib/scaffold.ts` → 32+/9-); its `fixes/247_lane4_emitted_honesty.md` is still a skeleton; mtime `2026-09-24 13:47:57`, 4 min before this probe → in-flight, not finished. **Not touched by this lane.**
- Consequence observed: `mock.test.ts` → `not ok 1 - runs the real P6 chunked pipeline … (zero network)` (11/12) because the test's dynamic import chain reaches `scaffold.ts`. Before my change and after, the failing module is identical and mine loads fine — attribution is the parse site, not the call path. Captured in `mock_baseline.txt`.

## §7 · Status
- **Done-when:** registry.test.ts green with the new pins ✅ · pins fail on a thinking flip ✅ (flips A/B) · alias-death refusal names the id ✅ (and fails without it — flip C) · each site's decision stated ✅ (§1).
- Open risks: (1) OV-28's *behaviour* arm is untouched by design — a pro model at a `json:true` site (e.g. an env pin `DEEPSEEK_MODEL_WEAK=deepseek-v4-pro`) still arms the E1 class unless the caller pins `thinking:false` (now pinned at this lane's two `llm-tasks` sites; other seams are other lanes' rows). (2) `scaffold.ts:741` must be fixed by LANE 4 before any suite that pulls `scaffold.ts` is trusted green.
