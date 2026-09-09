# Pro fixes — agent #4 (UI + store + enhancements)

> Written by the parent (agent hit its call budget before logging). Verified: typecheck 0, 284/284 tests, build 0, browser smoke clean.

## Bug fixes (audit-bugs/02)
- **UI-1** — `routes/run.$id.tsx`: `<RunScreen key={id}>` so local state (HITL note/error/tab/viewPhase) remounts per project/clone.
- **UI-2** — import: confirm before same-id overwrite, navigate to imported project, success notice.
- **UI-4/5/6/7/8 + A11Y-1** — busy latch prevents double-execute; approve clears stale rejection note; copy/export clear stale error; monotonic `copyTs` fixes overlapping timers; oracle empty-state + contracts row moved out of `<ul>`; notes textarea `id`+`label`.
- **ST-1** — `store.finishPhase()` records the DoD verdict **then** re-stamps the packet (auto-advance, P12-complete, and approve paths).
- **ST-2** — `reject()` mirrors `approve()` phase-match + awaiting_hitl guards.
- **ST-3** — `demoSeeded` flag: demo seeds once, never resurrects after archive.
- **ST-5** — `select()` rejects non-existent ids.

## Async engine wiring
- `synthesizeAsync` / `advanceOnceAsync` / `runReadyAsync` — delegate to `engine.runPhaseAsync` when `llmStatus.configured`, deterministic fallback otherwise.
- `llmStatus` / `researchStatus` in-memory surfaces populated by a best-effort `llmStatus()` probe on init.

## UI additions
- LLM/research status chips (configured / not-configured) + Guide control + settings copy ("keys live in `.env`, server-side").
- Keyboard/UX enhancements (per runtime-integration §3) within owned files.

## Caveat (parent reconciliation)
The server-boundary fix + narrative-decoupling were done by the parent after this agent's pass (see `fixes/07_llm_integration.md`).
