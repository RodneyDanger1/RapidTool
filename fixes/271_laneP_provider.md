# fixes/271_laneP_provider.md — W29 · LANE P (PROVIDER + TELEMETRY)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD at start:** `0f85c32` · **Lane:** P
(owns `src/lib/llm/**` incl. `providers/**`, `deepseek.server.ts`, `node-runner.server.ts`,
`rt-*` telemetry, `runtime-log.server.ts`; token-ledger/codegen budget seam per §R4's box)
**Brief read:** `wave_plans/W29/coders.md` + §W27-WORKLIST rows + §R4/§R11/§R12 specs in
`research/multiagent/thoroughanalysis.md`.

## Rows (from §W27-WORKLIST / coders.md LANE P)

- [ ] **R4-f01** · P1 · xAI 402 → `RT_E_LLM_NO_BALANCE` mirror (openai-compatible.ts `!res.ok`;
      broaden `errors.ts` NO_BALANCE doc; `registry.test.ts` case; re-run probe if present).
- [ ] **R4-f02** · P1-recheck · async-tap twin regression test (pin the promise channel;
      `run-eval.test.mjs` is H's box — home the pin in the lib leg).
- [ ] **R4-f03 / A2-f07 / R12-f02** · P2 · THE PER-RUN TOKEN LEDGER — `sessionTokenBudget()`
      singleton + `resetSessionBudget()`; codegen defaults switch to the singleton; delete
      duplicate `p6TokenCapFromEnv`; thread `{ budget }` at the headless verify seam (:3025).
- [ ] **C1-f08** · P3 · facade `thinking` in `complete()`'s public opts (`llm.ts`).
- [ ] **C1-f09 / R4-f05** · P3 · model-id validation in `completeDeepSeekInner` pre-network.
- [ ] **R11-f09** · P2 · redaction widening: iterate registry `apiKeyEnv` list; loosen `sk-` arm;
      redact provider refusal text before packet/logs.
- [ ] **R12-f06** · P2 · `readRtTail` true tail read (no whole-file readFileSync).

## Status log (append-only)

- [t0] Lane started; brief read; targets identified at HEAD `0f85c32`; all boxes read.
- [EXTERNAL NOTE] `fixes/271_laneB_builds.md`, `fixes/271_laneE1_p0s.md`, `fixes/271_laneU_ui.md`
  exist (peer lanes live in the same working tree). E1 owns `headless.ts` — the ledger's verify
  threading at `headless.ts:3025-3027` is a one-hunk cross-lane touch, flagged in the R4-f03
  entry below.
