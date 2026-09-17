# 212 G3 — harvest LLM dual-channel + knowledge residual + CLI-adjacent honesty

Lane: Grok-G3. Owned files only. Incremental.

## Scope

- `src/lib/harvest.ts` + `harvest.test.ts`
- `src/lib/prompt-engine.ts` + `prompt-engine.test.ts`
- `src/lib/knowledge.ts` + `knowledge.test.ts` (re-read; parent 209 accept/promote tests live here)
- `src/lib/crew.ts` (client wrapper residual)
- `src/lib/swarm.ts` — **no shape change** (already `ok:true` + `advisory:true` + `llmDispatched:false`, no `error`)
- `fixes/212_g3_harvest_knowledge_residual.md` (this log)

**Do not touch:** `scripts/rapidtool-cli.mjs`, `headless.ts`, `store.ts`, `engine.ts`, `README.md`.
No invented jobs. No keyed `--all`.

## Status

LANDED. Owned suite green (see Verification).

## Rule (185-H1)

- `ok: true` must **never** carry an `error` field.
- Hostile dual-channel stubs (`{ ok: true, error: "…" }`) fail-close — never treated as usable success.
- Shared detector: `dualChannelFailDetail` (`errors.ts`, 205).
- Empty/whitespace `error` is **not** dual-channel (matches 205).

## Findings + fixes

### 1. harvest — LLM seams compose the shared detector

**Residual:** `harvestLlmFailDetail` reimplemented 185-H1 locally and `defaultQueryLlm` stripped `error` off a completeDeepSeek `{ ok:true, error, text }` before the fail-close could see it — a hostile wrapper would mint `source:"llm"` queries.

**Landed:**

- Import `dualChannelFailDetail`.
- `defaultQueryLlm` fail-closes dual-channel **before** `{ ok:true, text }`.
- `harvestLlmFailDetail` composes the shared detector; `ok:false` still degrades to the keyword floor (`unknown` when the failure carries no prose).
- `harvestForPacket` stays `ok:true` + notes on keyword-floor degrade (never dual-channels `error` onto the packet).

### 2. prompt-engine — unused-import-safe dual-channel on expansionCall

**Residual:** `expansionCall` treated any `res.ok` as a spec candidate. A dual-channel stub would look like unparseable JSON and take the bounded **repair re-prompt** (wrong class: provider lie, not unparseable payload). Importing `dualChannelFailDetail` without using it would trip `@typescript-eslint/no-unused-vars`.

**Landed:** import **and use** `dualChannelFailDetail` after `res.ok`. Dual-channel → `{ ok:false, reason:"error" }` (no repair path). Clean success still `{ ok:true, spec }` with no `error` key.

### 3. knowledge — accept/promote pure-core edge cases

Parent 209 already: human `accepted` + `actor:*` bypasses missing maker-score; `acceptedLessonEntry` copies a finite row score.

**This lane:**

- `topLessonRows` blank-brief sort coerces non-finite scores to `0` (junk never NaN-sorts). Finite scores stay byte-identical.
- Pins: junk memory / NaN·Infinity·negative limit → `[]`; mixed junk rows filtered; blank actor → `cli-human`; null row → empty-text/unknown; `accepted` **without** `actor:*` still eval-gated (`RT_E_VALIDATION`).

### 4. swarm / crew advisory honesty (residual dual-ok)

- **swarm.ts:** no code change. 205/191 already stamp `ok:true` + `advisory:true` + `llmDispatched:false` with no `error`. Existing 185-H1 test kept. Swarm has no false branch — stripping `error` off `ok:true` would hide a lie, so we do not.
- **crew.ts:** client `runCrew` now fail-closes a hostile server `{ ok:true, error }` to `{ ok:false, reason:"error", code:"RT_E_INTERNAL" }`. Server completer path already fail-closed (205). Value-import of `crew.ts` in node:test would load `@tanstack/react-start` — no new client-wrapper test; `crew.server` dual-channel tests remain the pin.

## Verification

```text
node --experimental-strip-types --test \
  src/lib/harvest.test.ts \
  src/lib/prompt-engine.test.ts \
  src/lib/knowledge.test.ts \
  src/lib/swarm.test.ts \
  src/lib/crew.test.ts
# tests 175
# pass 175
# fail 0
# duration_ms ~6501
```

Full `npm test` / `gate.sh` **not** run (per task: targeted tests only). No keyed eval `--all`. No live DeepSeek burns.

## Files touched

| File | Action |
|------|--------|
| `src/lib/harvest.ts` | `dualChannelFailDetail` on `defaultQueryLlm` + `harvestLlmFailDetail` |
| `src/lib/harvest.test.ts` | whitespace-not-dual, ok:false unknown, packet dual-channel |
| `src/lib/prompt-engine.ts` | expansionCall dual-channel fail-close (import used) |
| `src/lib/prompt-engine.test.ts` | keyed success never carries `error` |
| `src/lib/knowledge.ts` | `topLessonRows` finite-score coerce on blank-brief floor |
| `src/lib/knowledge.test.ts` | 212 residual accept/promote edge cases |
| `src/lib/crew.ts` | client `runCrew` dual-channel fail-close |
| `src/lib/swarm.ts` | unchanged (already honest) |
| `fixes/212_g3_harvest_knowledge_residual.md` | this log |

## Honest residual holes (could not fix in-lane)

1. **CLI `lesson --accept` / harvest verb** — parent-owned `rapidtool-cli.mjs` / `headless.ts`. Pure core is ready; CLI envelope not wired here.
2. **crew.ts client wrapper untested in node:test** — `createServerFn` load. Server dual-channel pins cover the completer seam.
3. **prompt-engine dual-channel hostile path** — `completeDeepSeek` never stamps `error` on `ok:true`; no LLM inject seam (unlike harvest). Fail-close is defense-in-depth; keyed success pin covers the honest shape.
4. **Engine P1 still never calls harvest** (185-U2). Out of ownership.
5. **Swarm remains advisory-only.** `ok:true` means the pure plan function returned — not seats, not phases, not DoD.

## Still not a factory

Harvest keyword-floor on dual-channel is honesty plumbing, not live search. Swarm never dispatches. Human lesson-accept bypasses missing maker cards because the CLI flag **is** the gate — machine lesson writes still refuse unknown/regression scores.
