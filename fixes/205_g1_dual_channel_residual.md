# 205 G1 — dual-channel residual (185-H1) outside headless

Parent 204 already fixed headless wild start/pause/resume/stop to use
`note` on `ok:true` (never `error`). This lane closed the residual dual-channel
and missing-`RT_E` honesty holes in the wild classifier, crew, chat free-text
path, and the shared errors helper.

## Rule (185-H1)

- `ok: true` must **never** carry an `error` field.
- Soft success messages use `note` / `detail`.
- Failures use `ok: false` + `error` (+ `code` when the surface stamps RT_E).
- Hostile dual-channel stubs (`{ ok: true, error: "…" }`) fail-close — never
  treated as usable success.

## Changes

### `src/lib/errors.ts`
- New `dualChannelFailDetail(res)` — returns trimmed error prose when
  `ok === true` and `error` is a non-empty string; else `null`.
- Shared fail-close detector for wild / crew / chat (and future callers).

### `src/lib/wild-mode.server.ts`
- `createWildClassifier`: after a completer claims `ok:true`, dual-channel
  fail-closes to `{ ok:false, reason:"error", code:"RT_E_INTERNAL" }`.
- Clean success path unchanged (verdict + feedback + model; no `error`).

### `src/lib/crew.ts` + `src/lib/crew.server.ts`
- `CrewRunResult` false branch may carry `code?: ErrorCode`.
- Client `runCrew` catch stamps `classifyError(..., "RT_E_INTERNAL")`.
- All server failure returns stamp codes:
  - not-configured → `RT_E_LLM_NOT_CONFIGURED`
  - unknown roles override → `RT_E_VALIDATION`
  - agent/step/plan failures → upstream code or `RT_E_INTERNAL`
- `completeCrewTurn` + plan-act `deps.complete` dual-channel fail-close.
- `normalizeSearch`: dual-channel `{ ok:true, items, error }` → `ok:false`
  with `RT_E_INTERNAL` (never usable search hits).

### `src/lib/chat.server.ts`
- Free-text `completeDeepSeek` success path dual-channel fail-close
  (slash tools already return clean `ok:true` without `error`).

### `src/lib/swarm.ts`
- No shape change. Already pure `ok:true` + `advisory:true` +
  `llmDispatched:false` with no `error` channel. Tests pin 185-H1.

## Tests

- `errors.test.ts` — `dualChannelFailDetail` clean / dual / ok:false.
- `wild-mode.server.test.ts` — hostile dual-channel never a verdict.
- `crew.test.ts` — not-configured deepEqual includes code; ok:true no error;
  dual completer fail-close; configured:false gate stamps RT_E before dispatch.
- `swarm.test.ts` — plan/dag/branch ok:true never carries `error`; advisory pins.

## Not touched (parent-owned)

`headless.ts`, `store.ts`, `engine.ts`, `scripts/rapidtool-cli.mjs`, `README.md`.
No flip/record/show/publish job bodies invented.

## Still not a factory

Swarm remains advisory-only. Chat free-text still needs a key. Keyless slash
tools only. Dual-channel fail-close is honesty plumbing, not live LLM seats.
