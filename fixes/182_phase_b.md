# 182 — Phase B (+ C notes, E eval limit)

## B1 verify-kind
`verifyKindDir` runs emitted `package.json` `build`. No script → honest skip. CLI `emit --verify-kind` → `RT_E_VERIFY_KIND_FAILED` on red.

## B2 provenance
`package.json.rapidtool.{producer,packetId}` — `template` | `llm` | `floor`.

## B3 metering
M8 evidence cites measured tokens when supplied; otherwise labels "cycle count only (no measured token usage)". DeepSeek already returns usage additively.

## B4 / 174-5
`scrubbedEnv` is an allowlist. `DEEPSEEK_API_KEY` never reaches generated-code children.

## B5 / B6
`runAcceptance` single writer. CLI SIGTERM/SIGINT stamps `acceptance:"aborted"`. `RT_E_BUDGET_EXHAUSTED` + `RT_E_ABORTED` documented.

## C
`project.notes` injected into expandBrief lessons when non-empty (empty notes stay byte-identical).

## E
`run-eval.mjs`: keyed default still 1 entry; `--all` / `--limit=N` lifts `slice(0,1)`.
