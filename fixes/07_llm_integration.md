# LLM / research / exec integration (parent, mission 3) — LIVE-VERIFIED

## What shipped (4 Pro agents + parent integration)

**Server + client layers (Pro #1, #2)**
- `src/lib/deepseek.server.ts` — raw DeepSeek chat-completions (key from `process.env.DEEPSEEK_API_KEY` only; explicit V4 IDs `deepseek-v4-flash`/`deepseek-v4-pro`; `thinking:disabled` for flash, `enabled` for pro; retry on 429/500/503; per-status error map; honest `{ok:false,reason:"not-configured"}`).
- `src/lib/tavily.server.ts` — Tavily web-search (key from `TAVILY_API_KEY`).
- `src/lib/node-runner.server.ts` — local bounded runner (spawn `node -e`, mkdtemp cwd, proxy-scrubbed env, maxBuffer+slice caps, wall-clock timeout → `taskkill /T /F` on win32; honestly labeled "NOT a security sandbox").
- `src/lib/report-intake.ts` — `validateReport` + pure `applyReport` (agent-report → artifacts + log).

**Engine (Pro #3)** — `runPhaseAsync` (async research+narrative layered over deterministic `applyPhaseResult`, graceful fallback), `runP6Real` (bounded real-execution hook), CORE-03 hydrate `currentPhase` repair, ST-1 gate-verdict timing, defensive engine guards.

**Store + UI (Pro #4)** — UI-1 `key={id}` remount, UI-2 import confirm/navigate, ST-1 `finishPhase` (gate-then-restamp), ST-2/3/5, busy latch, a11y fixes, `synthesizeAsync`/`advanceOnceAsync`/`runReadyAsync` async engine path, `llmStatus`/`researchStatus` surface, Guide + status chips, keyboard/misc enhancements.

## Parent integration fixes (what the build/audit caught)

1. **Server-boundary build failure (Rolldown)** — `llm.ts`/`exec.ts`/`research.ts` directly imported their `.server.ts` modules. Fixed by routing through `createServerFn({method}).validator(...).handler(...)` with **dynamic** `await import("./*.server.ts")` inside the handler (the repo's own `server-only.ts` pattern). Tests repointed at the raw `.server.ts` functions (Node tests have `process` + mockable `fetch`).
2. **LLM narrative gated on research (gap)** — `engine.ts:fetchResearch` returned `null` when Tavily was unconfigured, so a configured DeepSeek never fired. Fixed: narrative is now generated whenever `llmStatus().configured`, independent of research; `cited` is a separate flag so illustrative competitor rows are only promoted to `cited` on real findings (never by narrative alone).
3. **Shadowing bug** — `llm.test.ts` `const status = await status()` (TDZ) → renamed local.

## Live end-to-end proof (with the user's real key)
- `GET /models` → `deepseek-v4-flash`, `deepseek-v4-pro`, `deepseek-v4-flash-vision-exp` (200).
- `POST /chat/completions` `thinking:{type:"disabled"}` → `content:"HELLO"` (200); without `thinking:disabled`, flash emits `reasoning_content` + empty `content` (reasoning-model trap — handled by the server layer's per-tier thinking flag).
- Browser smoke: intake → Execute P0 → store `configured:true` → `runPhaseAsync` → `complete()` → `createServerFn` → DeepSeek → **"Phase narrative (LLM)" artifact rendered** (real model text). Research honestly shows "not configured" (no Tavily key). 0 console/page errors.

## Final gate
typecheck 0 · TS suites **284/284** (16 files) · lint 0 · `npm run build` 0 · browser smoke 0 errors.

## One honest note
`research` needs a Tavily key to do real web search (DeepSeek's API has no built-in search). With only the DeepSeek key, the app does real LLM narratives/analysis but research stays honestly "illustrative". Add `TAVILY_API_KEY=` to `.env` to turn on live citations.
